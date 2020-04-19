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
import { throwError, of, from, forkJoin } from 'rxjs';
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
  LIST_CREDIT_NOTE_ENDPOINT,
} from '../../../constants/routes';
import { SalesInvoicePoliciesService } from '../../../sales-invoice/policies/sales-invoice-policies/sales-invoice-policies.service';
import { CreateSalesReturnDto } from '../../entity/sales-invoice/sales-return-dto';
import { DeliveryNote } from '../../../delivery-note/entity/delivery-note-service/delivery-note.entity';
import {
  CreateDeliveryNoteInterface,
  CreateDeliveryNoteItemInterface,
} from '../../../delivery-note/entity/delivery-note-service/create-delivery-note-interface';
import { DeliveryNoteWebhookDto } from '../../../delivery-note/entity/delivery-note-service/delivery-note-webhook.dto';
import { ErrorLogService } from '../../../error-log/error-log-service/error-log.service';
import { DateTime } from 'luxon';
import { ClientTokenManagerService } from '../../../auth/aggregates/client-token-manager/client-token-manager.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';

@Injectable()
export class SalesInvoiceAggregateService extends AggregateRoot {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly settingsService: SettingsService,
    private readonly http: HttpService,
    private readonly validateSalesInvoicePolicy: SalesInvoicePoliciesService,
    private readonly serialNoService: SerialNoService,
    private readonly errorLogService: ErrorLogService,
    private readonly clientToken: ClientTokenManagerService,
  ) {
    super();
  }

  addSalesInvoice(salesInvoicePayload: SalesInvoiceDto, clientHttpRequest) {
    return this.settingsService.find().pipe(
      switchMap(settings => {
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
              salesInvoice.created_on = new DateTime(
                settings.timeZone,
              ).toJSDate();
              salesInvoice.isSynced = false;
              salesInvoice.inQueue = false;
              this.apply(
                new SalesInvoiceAddedEvent(salesInvoice, clientHttpRequest),
              );
              return of({});
            }),
          );
      }),
    );
  }

  async retrieveSalesInvoice(uuid: string, req) {
    const provider = await this.salesInvoiceService.findOne(
      { uuid },
      undefined,
      true,
    );
    if (!provider) throw new NotFoundException();
    return provider;
  }

  async getSalesInvoiceList(offset, limit, sort, filter_query?) {
    return await this.salesInvoiceService.list(
      offset || 0,
      limit || 10,
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
        switchMap(successResponse => {
          return from(
            this.salesInvoiceService.updateOne(
              { uuid: salesInvoice.uuid },
              {
                $set: {
                  isSynced: true,
                  submitted: true,
                  inQueue: false,
                  name: successResponse.name,
                },
              },
            ),
          );
        }),
        catchError(err => {
          this.errorLogService.createErrorLog(
            err,
            'Sales Invoice',
            'salesInvoice',
            clientHttpRequest,
          );
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
      remarks: salesInvoice.remarks,
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
          switchMap((salesInvoice: SalesInvoice) => {
            this.createCreditNote(
              settings,
              createReturnPayload,
              clientHttpRequest,
              salesInvoice,
            );
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
                next: (response: DeliveryNoteWebhookDto) => {
                  const items = this.mapSerialsFromItem(response.items);

                  const returned_items_map = this.getReturnedItemsMap(
                    items,
                    salesInvoice,
                  );

                  this.linkSalesReturn(
                    items,
                    response.name,
                    clientHttpRequest.token,
                    salesInvoice.name,
                  );
                  this.salesInvoiceService.updateOne(
                    { uuid: salesInvoice.uuid },
                    { $set: { returned_items_map } },
                  );
                },
                error: err => {
                  this.errorLogService.createErrorLog(
                    err,
                    'Delivery Note',
                    'deliveryNote',
                    clientHttpRequest,
                  );
                },
              });
            return of({});
          }),
        );
      }),
    );
  }

  linkSalesReturn(
    items: any[],
    sales_return_name: string,
    token: any,
    sales_invoice_name: string,
  ) {
    const serials = [];

    items = items.filter(item => {
      if (item.serial_no) {
        serials.push(...item.serial_no.split('\n'));
      }
      item.deliveredBy = token.fullName;
      item.deliveredByEmail = token.email;
      item.sales_return_name = sales_return_name;
      return item;
    });
    this.serialNoService
      .updateMany(
        { serial_no: { $in: serials } },
        { $set: { sales_return_name } },
      )
      .then(success => {})
      .catch(error => {});

    this.salesInvoiceService
      .findOne({
        name: sales_invoice_name,
      })
      .then(sales_invoice => {
        this.salesInvoiceService
          .updateMany(
            { name: sales_invoice_name },
            {
              $push: { returned_items: { $each: items } },
            },
          )
          .then(success => {})
          .catch(error => {});
      })
      .catch(error => {});
  }

  updateOutstandingAmount(invoice_name: string) {
    return forkJoin({
      headers: this.clientToken.getServiceAccountApiHeaders(),
      settings: this.settingsService.find(),
    }).pipe(
      switchMap(({ headers, settings }) => {
        if (!settings || !settings.authServerURL)
          return throwError(new NotImplementedException());
        const url = `${settings.authServerURL}${FRAPPE_API_SALES_INVOICE_ENDPOINT}/${invoice_name}`;
        return this.http.get(url, { headers }).pipe(
          map(res => res.data.data),
          switchMap(sales_invoice => {
            this.salesInvoiceService
              .updateOne(
                { name: invoice_name },
                {
                  $set: {
                    outstanding_amount: sales_invoice.outstanding_amount,
                  },
                },
              )
              .then(success => {})
              .catch(error => {});
            return of({ outstanding_amount: sales_invoice.outstanding_amount });
          }),
        );
      }),
    );
  }

  createCreditNote(
    settings,
    assignPayload: CreateSalesReturnDto,
    clientHttpRequest,
    salesInvoice: SalesInvoice,
  ) {
    const body = this.mapCreditNote(assignPayload, salesInvoice);
    return this.http
      .post(settings.authServerURL + LIST_CREDIT_NOTE_ENDPOINT, body, {
        headers: {
          [AUTHORIZATION]:
            BEARER_HEADER_VALUE_PREFIX + clientHttpRequest.token.accessToken,
          [CONTENT_TYPE]: APPLICATION_JSON_CONTENT_TYPE,
          [ACCEPT]: APPLICATION_JSON_CONTENT_TYPE,
        },
      })
      .pipe(map(data => data.data.data))
      .subscribe({
        next: (success: { name: string }) => {
          this.salesInvoiceService
            .updateOne(
              { name: salesInvoice.name },
              { $set: { credit_note: success.name } },
            )
            .then(created => {})
            .catch(error => {});
        },
        error: err => {
          this.errorLogService.createErrorLog(
            err,
            'Credit Note',
            'salesInvoice',
            clientHttpRequest,
          );
        },
      });
  }

  mapCreditNote(
    assignPayload: CreateSalesReturnDto,
    salesInvoice: SalesInvoice,
  ) {
    // cleanup math calculations after DTO validations are added
    return {
      docstatus: 1,
      customer: assignPayload.customer,
      is_return: 1,
      company: assignPayload.company,
      posting_date: assignPayload.posting_date,
      return_against: salesInvoice.name,
      posting_time: assignPayload.posting_time,
      items: assignPayload.items.map(item => {
        return {
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
        };
      }),
    };
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

  getReturnedItemsMap(
    items: CreateDeliveryNoteItemInterface[],
    sales_invoice: SalesInvoice,
  ) {
    const returnItemsMap = {};
    items.forEach(item => {
      returnItemsMap[item.item_code] = item.qty;
    });
    for (const key of Object.keys(returnItemsMap)) {
      if (sales_invoice.returned_items_map[key]) {
        sales_invoice.returned_items_map[key] += returnItemsMap[key];
      } else {
        sales_invoice.returned_items_map[key] = returnItemsMap[key];
      }
    }
    return sales_invoice.returned_items_map;
  }
}
