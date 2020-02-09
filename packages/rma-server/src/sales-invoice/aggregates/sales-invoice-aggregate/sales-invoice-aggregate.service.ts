import {
  Injectable,
  NotFoundException,
  BadRequestException,
  NotImplementedException,
  HttpService,
} from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import * as uuidv4 from 'uuid/v4';
import { SalesInvoiceDto } from '../../entity/sales-invoice/sales-invoice-dto';
import { SalesInvoice } from '../../entity/sales-invoice/sales-invoice.entity';
import { SalesInvoiceAddedEvent } from '../../event/sales-invoice-added/sales-invoice-added.event';
import { SalesInvoiceService } from '../../entity/sales-invoice/sales-invoice.service';
import { SalesInvoiceRemovedEvent } from '../../event/sales-invoice-removed/sales-invoice-removed.event';
import { SalesInvoiceUpdatedEvent } from '../../event/sales-invoice-updated/sales-invoice-updated.event';
import { SalesInvoiceUpdateDto } from '../../entity/sales-invoice/sales-invoice-update-dto';
import { SALES_INVOICE_CANNOT_BE_UPDATED } from '../../../constants/messages';
import { SalesInvoiceSubmittedEvent } from '../../event/sales-invoice-submitted/sales-invoice-submitted.event';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { switchMap, map, catchError } from 'rxjs/operators';
import { throwError, of, from } from 'rxjs';
import {
  AUTHORIZATION,
  BEARER_HEADER_VALUE_PREFIX,
  CONTENT_TYPE,
  APPLICATION_JSON_CONTENT_TYPE,
  DRAFT_STATUS,
} from '../../../constants/app-strings';
import { ACCEPT } from '../../../constants/app-strings';
import { APP_WWW_FORM_URLENCODED } from '../../../constants/app-strings';
import {
  FRAPPE_API_SALES_INVOICE_ENDPOINT,
  POST_DELIVERY_NOTE_ENDPOINT,
} from '../../../constants/routes';
import { SalesInvoicePoliciesService } from '../../../sales-invoice/policies/sales-invoice-policies/sales-invoice-policies.service';
import { CreateSalesReturnDto } from '../../entity/sales-invoice/sales-return-dto';
import { DeliveryNote } from '../../../delivery-note/entity/delivery-note-service/delivery-note.entity';
import {
  CreateDeliveryNoteInterface,
  CreateDeliveryNoteItemInterface,
} from '../../../delivery-note/entity/delivery-note-service/create-delivery-note-interface';
import { DeliveryNoteWebhookDto } from '../../../delivery-note/entity/delivery-note-service/delivery-note-webhook.dto';
import { DeliveryNoteService } from '../../../delivery-note/entity/delivery-note-service/delivery-note.service';

@Injectable()
export class SalesInvoiceAggregateService extends AggregateRoot {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly settingsService: SettingsService,
    private readonly http: HttpService,
    private readonly validateSalesInvoicePolicy: SalesInvoicePoliciesService,
    private readonly deliveryNoteService: DeliveryNoteService,
  ) {
    super();
  }

  addSalesInvoice(salesInvoicePayload: SalesInvoiceDto, clientHttpRequest) {
    return this.validateSalesInvoicePolicy
      .validateCustomer(salesInvoicePayload)
      .pipe(
        switchMap(() => {
          return this.validateSalesInvoicePolicy.validateItems(
            salesInvoicePayload.items,
          );
        }),
        switchMap(() => {
          const salesInvoice = new SalesInvoice();
          Object.assign(salesInvoice, salesInvoicePayload);
          salesInvoice.createdByEmail = clientHttpRequest.token.email;
          salesInvoice.createdBy = clientHttpRequest.token.fullName;
          salesInvoice.uuid = uuidv4();
          salesInvoice.isSynced = false;
          salesInvoice.inQueue = false;
          this.apply(
            new SalesInvoiceAddedEvent(salesInvoice, clientHttpRequest),
          );
          return of({});
        }),
      );
  }

  async retrieveSalesInvoice(uuid: string, req) {
    const provider = await this.salesInvoiceService.findOne({ uuid });
    if (!provider) throw new NotFoundException();
    return provider;
  }

  async getSalesInvoiceList(offset, limit, sort, filter_query?) {
    return await this.salesInvoiceService.list(
      offset,
      limit,
      sort,
      filter_query,
    );
  }

  async remove(uuid: string) {
    const found = await this.salesInvoiceService.findOne({ uuid });
    if (!found) {
      throw new NotFoundException();
    }
    this.apply(new SalesInvoiceRemovedEvent(found));
  }

  async update(updatePayload: SalesInvoiceUpdateDto) {
    const provider = await this.salesInvoiceService.findOne({
      uuid: updatePayload.uuid,
    });
    if (!provider) {
      throw new NotFoundException();
    }
    if (provider.status !== DRAFT_STATUS) {
      throw new BadRequestException(
        provider.status + SALES_INVOICE_CANNOT_BE_UPDATED,
      );
    }
    this.apply(new SalesInvoiceUpdatedEvent(updatePayload));
  }

  submitSalesInvoice(uuid: string, clientHttpRequest: any) {
    return this.validateSalesInvoicePolicy.validateSalesInvoice(uuid).pipe(
      switchMap(salesInvoice => {
        return this.validateSalesInvoicePolicy
          .validateCustomer(salesInvoice)
          .pipe(
            switchMap(() => {
              return this.validateSalesInvoicePolicy
                .validateSubmittedState(salesInvoice)
                .pipe(
                  switchMap(() => {
                    return this.validateSalesInvoicePolicy.validateQueueState(
                      salesInvoice,
                    );
                  }),
                )
                .pipe(
                  switchMap(isValid => {
                    return from(
                      this.salesInvoiceService.updateOne(
                        { uuid: salesInvoice.uuid },
                        { $set: { inQueue: true } },
                      ),
                    ).pipe(
                      switchMap(() => {
                        this.apply(
                          new SalesInvoiceSubmittedEvent(salesInvoice),
                        );
                        return this.syncSubmittedSalesInvoice(
                          salesInvoice,
                          clientHttpRequest,
                        );
                      }),
                    );
                  }),
                );
            }),
          );
      }),
    );
  }

  syncSubmittedSalesInvoice(
    salesInvoice: SalesInvoice,
    clientHttpRequest: any,
  ) {
    return this.settingsService
      .find()
      .pipe(
        switchMap(settings => {
          if (!settings || !settings.authServerURL) {
            this.salesInvoiceService
              .updateOne(
                { uuid: salesInvoice.uuid },
                { $set: { inQueue: false } },
              )
              .then(success => {})
              .catch(error => {});
            return throwError(new NotImplementedException());
          }
          const body = this.mapSalesInvoice(salesInvoice);

          return this.http.post(
            settings.authServerURL + FRAPPE_API_SALES_INVOICE_ENDPOINT,
            body,
            {
              headers: {
                [AUTHORIZATION]:
                  BEARER_HEADER_VALUE_PREFIX +
                  clientHttpRequest.token.accessToken,
                [CONTENT_TYPE]: APP_WWW_FORM_URLENCODED,
                [ACCEPT]: APPLICATION_JSON_CONTENT_TYPE,
              },
            },
          );
        }),
      )
      .pipe(map(data => data.data.data))
      .pipe(
        switchMap(success => {
          return from(
            this.salesInvoiceService.updateOne(
              { uuid: salesInvoice.uuid },
              {
                $set: {
                  isSynced: true,
                  submitted: true,
                  inQueue: false,
                  name: success.name,
                },
              },
            ),
          );
        }),
        catchError(err => {
          this.salesInvoiceService
            .updateOne(
              { uuid: salesInvoice.uuid },
              {
                $set: {
                  inQueue: false,
                  isSynced: false,
                  submitted: false,
                  status: DRAFT_STATUS,
                },
              },
            )
            .then(updated => {})
            .catch(error => {});
          return throwError(
            new BadRequestException(err.response ? err.response.data.exc : err),
          );
        }),
      );
  }

  mapSalesInvoice(salesInvoice: SalesInvoice) {
    return {
      // title: salesInvoice.title ,
      docstatus: 1,
      customer: salesInvoice.customer,
      company: salesInvoice.company,
      posting_date: salesInvoice.posting_date,
      set_posting_time: salesInvoice.set_posting_time,
      due_date: salesInvoice.due_date,
      contact_email: salesInvoice.contact_email,
      territory: salesInvoice.territory,
      total_qty: salesInvoice.total_qty,
      update_stock: salesInvoice.update_stock,
      total: salesInvoice.total,
      items: salesInvoice.items.filter(each => {
        delete each.owner;
        return each;
      }),
      timesheets: salesInvoice.timesheets,
      taxes: salesInvoice.taxes,
      payment_schedule: salesInvoice.payment_schedule,
      payments: salesInvoice.payments,
      sales_team: salesInvoice.sales_team,
    };
  }

  createSalesReturn(
    createReturnPayload: CreateSalesReturnDto,
    clientHttpRequest,
  ) {
    return this.settingsService.find().pipe(
      switchMap(settings => {
        if (!settings) {
          return throwError(new NotImplementedException());
        }
        return from(
          this.validateSalesInvoicePolicy.validateSalesReturn(
            createReturnPayload,
          ),
        ).pipe(
          switchMap(salesReturn => {
            const deliveryNote = new DeliveryNote();
            Object.assign(deliveryNote, createReturnPayload);
            this.http
              .post(
                settings.authServerURL + POST_DELIVERY_NOTE_ENDPOINT,
                deliveryNote,
                {
                  headers: {
                    [AUTHORIZATION]:
                      BEARER_HEADER_VALUE_PREFIX +
                      clientHttpRequest.token.accessToken,
                    [CONTENT_TYPE]: APP_WWW_FORM_URLENCODED,
                    [ACCEPT]: APPLICATION_JSON_CONTENT_TYPE,
                  },
                },
              )
              .pipe(map(data => data.data.data))
              .subscribe({
                next: response => {
                  const deliveryNoteData = new DeliveryNote();
                  deliveryNoteData.uuid = uuidv4();
                  deliveryNoteData.isSynced = false;
                  deliveryNoteData.inQueue = false;
                  deliveryNoteData.is_return = true;
                  deliveryNoteData.createdByEmail =
                    clientHttpRequest.token.email;
                  deliveryNoteData.createdBy = clientHttpRequest.token.fullName;
                  deliveryNoteData.issue_credit_note = true;
                  const delivery = this.mapCreateDeliveryNote(response);
                  Object.assign(deliveryNoteData, delivery);
                  this.deliveryNoteService.create(deliveryNoteData);
                },
                error: err => {},
              });
            return of({});
          }),
        );
      }),
    );
  }

  mapCreateDeliveryNote(
    assignPayload: DeliveryNoteWebhookDto,
  ): CreateDeliveryNoteInterface {
    const deliveryNoteBody: CreateDeliveryNoteInterface = {};
    deliveryNoteBody.docstatus = 1;
    deliveryNoteBody.posting_date = assignPayload.posting_date;
    deliveryNoteBody.posting_time = assignPayload.posting_time;
    deliveryNoteBody.is_return = true;
    deliveryNoteBody.issue_credit_note = true;
    deliveryNoteBody.contact_email = assignPayload.contact_email;
    deliveryNoteBody.set_warehouse = assignPayload.set_warehouse;
    deliveryNoteBody.customer = assignPayload.customer;
    deliveryNoteBody.company = assignPayload.company;
    deliveryNoteBody.total_qty = assignPayload.total_qty;
    deliveryNoteBody.total = assignPayload.total;
    deliveryNoteBody.items = this.mapSerialsFromItem(assignPayload.items);
    // deliveryNoteBody.pricing_rules = []
    // deliveryNoteBody.packed_items = []
    // deliveryNoteBody.taxes = []
    // deliveryNoteBody.sales_team = []
    return deliveryNoteBody;
  }

  mapSerialsFromItem(items: CreateDeliveryNoteItemInterface[]) {
    const itemData = [];
    items.forEach(eachItemData => {
      itemData.push({
        item_code: eachItemData.item_code,
        qty: eachItemData.qty,
        rate: eachItemData.rate,
        serial_no: eachItemData.serial_no,
        against_sales_invoice: eachItemData.against_sales_invoice,
        amount: eachItemData.amount,
      });
    });
    return itemData;
  }
}
