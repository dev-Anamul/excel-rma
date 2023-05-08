import { Injectable, Inject } from '@nestjs/common';
import { switchMap, mergeMap, catchError, retry, map } from 'rxjs/operators';
import {
  VALIDATE_AUTH_STRING,
  COMPLETED_STATUS,
  TO_DELIVER_STATUS,
  CREATE_DELIVERY_NOTE_JOB,
  AGENDA_JOB_STATUS,
  FRAPPE_SYNC_DATA_IMPORT_QUEUE_JOB,
  DELIVERY_NOTE_DOCTYPE,
  SYNC_DELIVERY_NOTE_JOB,
  DEFAULT_NAMING_SERIES,
  DEFAULT_CURRENCY,
  NON_SERIAL_ITEM,
} from '../../../constants/app-strings';
import { DirectService } from '../../../direct/aggregates/direct/direct.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { of, throwError, Observable, from } from 'rxjs';
import { CreateDeliveryNoteInterface } from '../../entity/delivery-note-service/create-delivery-note-interface';
import { ServerSettings } from '../../../system-settings/entities/server-settings/server-settings.entity';
import { DateTime } from 'luxon';
import { SalesInvoice } from '../../../sales-invoice/entity/sales-invoice/sales-invoice.entity';
import { SalesInvoiceService } from '../../../sales-invoice/entity/sales-invoice/sales-invoice.service';
import { FRAPPE_QUEUE_JOB } from '../../../constants/app-strings';
import Agenda = require('agenda');
import { AGENDA_TOKEN } from '../../../system-settings/providers/agenda.provider';
import { DeliveryNoteJobHelperService } from '../delivery-note-job-helper/delivery-note-job-helper.service';
import { v4 as uuidv4 } from 'uuid';
import { AgendaJobService } from '../../../sync/entities/agenda-job/agenda-job.service';
import {
  DataImportService,
  SingleDoctypeResponseInterface,
} from '../../../sync/aggregates/data-import/data-import.service';
import { JsonToCSVParserService } from '../../../sync/entities/agenda-job/json-to-csv-parser.service';
import {
  CSV_TEMPLATE_HEADERS,
  CSV_TEMPLATE,
} from '../../../sync/assets/data_import_template';
import { DataImportSuccessResponse } from '../../../sync/entities/agenda-job/agenda-job.entity';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import {
  EventType,
  SerialNoHistoryInterface,
} from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { getParsedPostingDate } from '../../../constants/agenda-job';
import { StockLedger } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.entity';
import { StockLedgerService } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.service';
import { DeliveryNoteItemDto } from '../../../serial-no/entity/serial-no/assign-serial-dto';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { ItemService } from '../../../item/entity/item/item.service';
export const CREATE_STOCK_ENTRY_JOB = 'CREATE_STOCK_ENTRY_JOB';

@Injectable()
export class DeliveryNoteJobService {
  constructor(
    @Inject(AGENDA_TOKEN)
    private readonly agenda: Agenda,
    private readonly tokenService: DirectService,
    private readonly serialNoService: SerialNoService,
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly jobService: AgendaJobService,
    private readonly jobHelper: DeliveryNoteJobHelperService,
    private readonly csvService: JsonToCSVParserService,
    private readonly importData: DataImportService,
    private readonly serialNoHistoryService: SerialNoHistoryService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly settingsService: SettingsService,
    private readonly itemService: ItemService,
  ) {}

  execute(job) {
    return this.createDeliveryNote(job.attrs.data);
  }

  resetState(job: {
    data: {
      payload: CreateDeliveryNoteInterface;
      token: any;
      settings: ServerSettings;
      sales_invoice_name: string;
      parent: string;
    };
  }): Observable<boolean> {
    const serials = [];
    const query: { [key: string]: number } = {};

    job.data.payload.items.forEach(item => {
      if (query[Buffer.from(item.item_code).toString('base64')]) {
        query[Buffer.from(item.item_code).toString('base64')] += item.qty;
      } else {
        query[Buffer.from(item.item_code).toString('base64')] = item.qty;
      }

      if (item.has_serial_no) {
        if (typeof item.serial_no === 'string') {
          serials.push(...item.serial_no.split('\n'));
        } else {
          serials.push(...item.serial_no);
        }
      }
    });

    Object.keys(query).forEach(key => {
      query[`delivered_items_map.${key}`] = 0 - query[key];
      delete query[key];
    });

    this.salesInvoiceService
      .updateOne({ name: job.data.sales_invoice_name }, { $inc: query })
      .then(() => {
        this.salesInvoiceService
          .findOne({ name: job.data.sales_invoice_name })
          .then(salesInvoice => {
            const status = this.getStatus(salesInvoice);
            this.salesInvoiceService.updateOne(
              { name: salesInvoice.name },
              { $set: { status } },
            );
          })
          .catch(() => {});
      })
      .catch(() => {});

    this.serialNoService.updateMany(
      { serial_no: { $in: serials } },
      {
        $unset: {
          'queue_state.delivery_note': 1,
        },
      },
    );

    return of(true);
  }

  createDeliveryNote(job: {
    payload: CreateDeliveryNoteInterface;
    token: any;
    settings: ServerSettings;
    sales_invoice_name: string;
    dataImport: DataImportSuccessResponse;
    parent: string;
    uuid: string;
  }) {
    let payload = job.payload;
    return of({}).pipe(
      switchMap(() => {
        payload = this.setCsvDefaults(payload, job.settings);
        const csvPayload = this.csvService.mapJsonToCsv(
          payload,
          CSV_TEMPLATE_HEADERS.delivery_note_legacy,
          CSV_TEMPLATE.delivery_note_legacy,
        );
        return this.importData.addDataImport(
          DELIVERY_NOTE_DOCTYPE,
          csvPayload,
          job.settings,
          job.token,
        );
      }),
      catchError(err => {
        if (
          (err && err.response && err.response.status === 403) ||
          (err &&
            err.response &&
            err.response.data &&
            err.response.data.exc &&
            err.response.data.exc.includes(VALIDATE_AUTH_STRING))
        ) {
          return this.tokenService.getUserAccessToken(job.token.email).pipe(
            mergeMap(token => {
              this.jobService.updateJobTokens(
                job.token.accessToken,
                token.accessToken,
              );
              job.token.accessToken = token.accessToken;
              return throwError(err);
            }),
            catchError(() => {
              return throwError(err);
            }),
          );
        }
        return throwError(err);
      }),
      retry(3),
      switchMap((success: DataImportSuccessResponse) => {
        job.dataImport = success;
        job.uuid = uuidv4();
        this.addToExportedQueue(job);
        return of({});
      }),
    );
  }

  setCsvDefaults(payload, settings: ServerSettings) {
    payload.naming_series = payload.naming_series
      ? payload.naming_series
      : DEFAULT_NAMING_SERIES.delivery_note;
    payload.set_posting_time = 1;
    payload.price_list_currency = payload.price_list_currency
      ? payload.price_list_currency
      : DEFAULT_CURRENCY;
    payload.selling_price_list = payload.selling_price_list
      ? payload.selling_price_list
      : settings.sellingPriceList;
    payload.plc_conversion_rate = payload.plc_conversion_rate
      ? payload.plc_conversion_rate
      : 1;
    payload.status = payload.status ? payload.status : 'To Bill';
    payload.items[0].uom = payload.items[0].uom ? payload.items[0].uom : 'Nos';
    payload.items[0].description = payload.items[0].description
      ? payload.items[0].description
      : payload.items[0].item_name;
    payload.items[0].stock_uom = payload.items[0].stock_uom
      ? payload.items[0].stock_uom
      : 'Nos';
    payload.items[0].conversion_factor = payload.items[0].conversion_factor
      ? payload.items[0].conversion_factor
      : 1;
    return payload;
  }

  syncExistingSerials(
    job: {
      payload: CreateDeliveryNoteInterface;
      token: any;
      settings: ServerSettings;
      sales_invoice_name: string;
    },
    error,
  ): Observable<any> {
    const serials = [];
    job.payload.items.forEach(item => {
      if (item.has_serial_no) {
        if (typeof item.serial_no === 'string') {
          serials.push(...item.serial_no.split('\n'));
        } else {
          serials.push(...item.serial_no);
        }
      }
    });

    return this.jobHelper
      .validateFrappeSyncExistingSerials(
        serials,
        job.settings,
        job.token,
        job.sales_invoice_name,
      )
      .pipe(
        switchMap(data => {
          return of(data);
        }),
      );
  }

  linkDeliveryNote(
    payload: CreateDeliveryNoteInterface,
    response: SingleDoctypeResponseInterface,
    token: any,
    settings: ServerSettings,
    sales_invoice_name: string,
  ) {
    const items = [];
    payload.items.forEach(item => {
      if (item.has_serial_no) {
        const serialArray =
          typeof item.serial_no === 'string'
            ? item.serial_no.split('\n')
            : item.serial_no;
        this.serialNoService
          .updateMany(
            {
              serial_no: {
                $in: serialArray,
              },
            },
            {
              $set: {
                sales_invoice_name,
                'warranty.salesWarrantyDate': item.warranty_date,
                'warranty.soldOn': DateTime.fromJSDate(
                  getParsedPostingDate(payload),
                )
                  .setZone(settings.timeZone)
                  .toJSDate(),
                delivery_note: response.name,
                warehouse: payload.set_warehouse,
                customer: payload.customer,
              },
              $unset: {
                'queue_state.delivery_note': null,
              },
            },
          )
          .then(() => {
            const serialHistory: SerialNoHistoryInterface = {};
            serialHistory.created_by = token.fullName;
            serialHistory.created_on = new DateTime(
              settings.timeZone,
            ).toJSDate();
            serialHistory.document_no = response.name;
            serialHistory.readable_document_no = sales_invoice_name;
            serialHistory.document_type = DELIVERY_NOTE_DOCTYPE;
            serialHistory.eventDate = new DateTime(settings.timeZone);
            serialHistory.eventType = EventType.SerialDelivered;
            serialHistory.parent_document = sales_invoice_name;
            serialHistory.transaction_from = payload.set_warehouse;
            serialHistory.transaction_to = payload.customer;
            this.serialNoHistoryService
              .addSerialHistory(serialArray, serialHistory)
              .subscribe();
            return true;
          });
      }
    });

    response.items.forEach(item => {
      let valuation_rate: number = 0;

      this.itemService
        .findOne({ item_code: item.item_code })
        .then(item_details => {
          valuation_rate = item_details.valuation_rate;
          items.push({
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.description,
            deliveredBy: token.fullName,
            deliveredByEmail: token.email,
            qty: item.qty,
            rate: item_details.valuation_rate,
            amount: item_details.valuation_rate,
            serial_no: item.serial_no || NON_SERIAL_ITEM,
            delivery_note: response.name,
          });

          this.salesInvoiceService.updateOne(
            { name: sales_invoice_name },
            {
              $push: {
                delivery_note_items: { $each: items },
                delivery_note_names: response.name,
              },
            },
          );
        });

      // fetch stock availability
      return this.stockLedgerService
        .asyncAggregate([
          {
            $group: {
              _id: {
                warehouse: '$warehouse',
                item_code: '$item_code',
              },
              stockAvailability: {
                $sum: '$actual_qty',
              },
            },
          },
          {
            $lookup: {
              from: 'item',
              localField: '_id.item_code',
              foreignField: 'item_code',
              as: 'item',
            },
          },
          { $unwind: '$item' },
          {
            $match: {
              'item.item_code': item.item_code,
              '_id.warehouse': payload.set_warehouse,
              stockAvailability: { $gt: 0 },
            },
          },
        ])
        .pipe(
          map(data => data[0]),
          switchMap(res => {
            return this.createStockLedgerPayload(
              {
                warehouse: payload.set_warehouse,
                deliveryNoteItem: item,
              },
              token,
              settings,
              valuation_rate,
              res?.stockAvailability || 0,
            ).pipe(
              switchMap((response: StockLedger) => {
                return from(this.stockLedgerService.create(response));
              }),
            );
          }),
        )
        .subscribe();
    });

    return of(true);
  }

  createStockLedgerPayload(
    payload: { warehouse: string; deliveryNoteItem: DeliveryNoteItemDto },
    token: any,
    settings: ServerSettings,
    valuation_rate: number,
    stock_availability: number,
  ) {
    return this.settingsService.getFiscalYear(settings).pipe(
      switchMap(fiscalYear => {
        const date = new DateTime(settings.timeZone).toJSDate();
        const stockPayload = new StockLedger();
        stockPayload.name = uuidv4();
        stockPayload.modified = date;
        stockPayload.modified_by = token.email;
        stockPayload.warehouse = payload.warehouse;
        stockPayload.item_code = payload.deliveryNoteItem.item_code;
        stockPayload.actual_qty = -payload.deliveryNoteItem.qty;
        stockPayload.balance_qty =
          stock_availability - -stockPayload.actual_qty;
        stockPayload.valuation_rate = valuation_rate;
        stockPayload.balance_value = parseFloat(
          (stockPayload.balance_qty * stockPayload.valuation_rate).toFixed(2),
        );
        stockPayload.posting_date = date;
        stockPayload.posting_time = date;
        stockPayload.voucher_type = DELIVERY_NOTE_DOCTYPE;
        stockPayload.voucher_no =
          payload.deliveryNoteItem.against_sales_invoice;
        stockPayload.outgoing_rate = payload.deliveryNoteItem.rate;
        stockPayload.qty_after_transaction = stockPayload.actual_qty;
        stockPayload.stock_value =
          stockPayload.qty_after_transaction * stockPayload.valuation_rate;
        stockPayload.stock_value_difference =
          stockPayload.actual_qty * stockPayload.valuation_rate;
        stockPayload.company = settings.defaultCompany;
        stockPayload.fiscal_year = fiscalYear;
        return of(stockPayload);
      }),
    );
  }

  getStatus(sales_invoice: SalesInvoice) {
    const total = sales_invoice.has_bundle_item
      ? Object.values(sales_invoice.bundle_items_map).reduce(
          (a: number, b: number) => a + b,
          0,
        )
      : sales_invoice.total_qty;

    const delivered_qty = Object.values(
      sales_invoice.delivered_items_map,
    ).reduce((a: number, b: number) => a + b, 0);

    return total === delivered_qty ? COMPLETED_STATUS : TO_DELIVER_STATUS;
  }

  addToQueueNow(data: {
    payload: CreateDeliveryNoteInterface;
    token: any;
    settings: ServerSettings;
    sales_invoice_name: string;
    type?: string;
    parent?: string;
    status?: string;
  }) {
    data.type = CREATE_DELIVERY_NOTE_JOB;
    data.parent = data.sales_invoice_name;
    data.status = AGENDA_JOB_STATUS.in_queue;
    data.payload.items.forEach(element => {
      if (typeof element.serial_no !== 'string') {
        try {
          element.serial_no = element.serial_no.join('\n');
        } catch {}
      }
    });
    return this.agenda.now(FRAPPE_QUEUE_JOB, data);
  }

  addToExportedQueue(job: {
    dataImport: DataImportSuccessResponse;
    uuid: string;
    settings: ServerSettings;
    token: any;
    parent: string;
  }) {
    const job_data = {
      payload: job.dataImport,
      uuid: job.uuid,
      type: SYNC_DELIVERY_NOTE_JOB,
      settings: job.settings,
      token: job.token,
      parent: job.parent,
    };
    return this.agenda.now(FRAPPE_SYNC_DATA_IMPORT_QUEUE_JOB, job_data);
  }
}
