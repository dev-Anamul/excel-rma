import { Injectable, Inject } from '@nestjs/common';
import { DateTime } from 'luxon';
import * as Agenda from 'agenda';
import { AGENDA_TOKEN } from '../../../system-settings/providers/agenda.provider';
import { of, throwError, from } from 'rxjs';
import {
  mergeMap,
  catchError,
  switchMap,
  toArray,
  retry,
  map,
  concatMap,
} from 'rxjs/operators';
import {
  VALIDATE_AUTH_STRING,
  FRAPPE_QUEUE_JOB,
  AGENDA_JOB_STATUS,
  DEFAULT_CURRENCY,
  DEFAULT_NAMING_SERIES,
} from '../../../constants/app-strings';
import { ServerSettings } from '../../../system-settings/entities/server-settings/server-settings.entity';
import { DirectService } from '../../../direct/aggregates/direct/direct.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { PurchaseReceiptService } from '../../entity/purchase-receipt.service';
import { PurchaseInvoiceService } from '../../../purchase-invoice/entity/purchase-invoice/purchase-invoice.service';
import {
  PurchaseReceiptDto,
  PurchaseReceiptItemDto,
} from '../../entity/purchase-receipt-dto';
import { v4 as uuidv4 } from 'uuid';
import { PURCHASE_RECEIPT_DOCTYPE_NAME } from '../../../constants/app-strings';
import { TokenCache } from '../../../auth/entities/token-cache/token-cache.entity';
import { PurchaseReceipt } from '../../entity/purchase-receipt.entity';
import {
  DataImportService,
  SingleDoctypeResponseInterface,
} from '../../../sync/aggregates/data-import/data-import.service';
import { AgendaJobService } from '../../../sync/entities/agenda-job/agenda-job.service';
import { JsonToCSVParserService } from '../../../sync/entities/agenda-job/json-to-csv-parser.service';
import {
  CSV_TEMPLATE_HEADERS,
  CSV_TEMPLATE,
} from '../../../sync/assets/data_import_template';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import { SerialNoHistoryInterface } from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { EventType } from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { getParsedPostingDate } from '../../../constants/agenda-job';
import { StockLedger } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.entity';
import { StockLedgerService } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.service';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';

export const CREATE_PURCHASE_RECEIPT_JOB = 'CREATE_PURCHASE_RECEIPT_JOB';

@Injectable()
export class PurchaseReceiptSyncService {
  constructor(
    @Inject(AGENDA_TOKEN)
    private readonly agenda: Agenda,
    private readonly tokenService: DirectService,
    private readonly importData: DataImportService,
    private readonly serialNoService: SerialNoService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
    private readonly jobService: AgendaJobService,
    private readonly serialNoHistoryService: SerialNoHistoryService,
    private readonly purchaseReceiptService: PurchaseReceiptService,
    private readonly jsonToCsv: JsonToCSVParserService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly settingsService: SettingsService,
  ) {}

  execute(job) {
    return this.createPurchaseReceipt(job.attrs.data);
  }

  resetState(job: {
    data: {
      payload: PurchaseReceiptDto[];
      token: any;
      settings: ServerSettings;
      purchase_invoice_name: string;
    };
  }) {
    const item_hash = { serials: [] };
    return of({}).pipe(
      switchMap(parent => {
        return from(job.data.payload);
      }),
      switchMap(purchaseReceipt => {
        return from(purchaseReceipt.items).pipe(
          switchMap(item => {
            if (item_hash[item.item_code]) {
              item_hash[item.item_code] += item.qty;
            } else {
              item_hash[item.item_code] = item.qty;
            }
            if (item.has_serial_no) {
              if (typeof item.serial_no === 'string') {
                item_hash.serials.push(...item.serial_no.split('\n'));
              } else {
                item_hash.serials.push(...item.serial_no);
              }
            }
            return of({});
          }),
        );
      }),
      toArray(),
      switchMap(success => {
        const decrementQuery = {};
        const item_codes = Object.keys(item_hash);
        item_codes.forEach(code => {
          if (code === 'serials') {
            return;
          }
          decrementQuery[
            `purchase_receipt_items_map.${Buffer.from(code).toString('base64')}`
          ] = -item_hash[code];
        });
        return from(
          this.purchaseInvoiceService.updateOne(
            { name: job.data.purchase_invoice_name },
            { $inc: decrementQuery },
          ),
        );
      }),
      switchMap(done => {
        return from(
          this.serialNoService.updateMany(
            { serial_no: { $in: item_hash.serials } },
            { $unset: { 'queue_state.purchase_receipt': undefined } },
          ),
        ).pipe(
          map(data => {
            return data;
          }),
        );
      }),
    );
  }

  createPurchaseReceipt(job: {
    payload: PurchaseReceiptDto[];
    token: any;
    settings: any;
    purchase_invoice_name: string;
    parent: string;
    dataImport: any;
    uuid: string;
  }) {
    return of({}).pipe(
      mergeMap(object => {
        const payload = this.setPurchaseReceiptDefaults(
          job.payload,
          job.settings,
        );
        job.uuid = uuidv4();
        const csv_payload = this.jsonToCsv.mapJsonToCsv(
          payload,
          CSV_TEMPLATE_HEADERS.purchase_receipt_legacy,
          CSV_TEMPLATE.purchase_receipt_legacy,
        );
        return this.importData.addDataImport(
          PURCHASE_RECEIPT_DOCTYPE_NAME,
          csv_payload,
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
            catchError(error => {
              return throwError(err);
            }),
          );
        }
        return throwError(err);
      }),
      retry(3),
      switchMap(success => {
        job.dataImport = success;
        return of(true);
      }),
    );
  }

  setPurchaseReceiptDefaults(
    payload: PurchaseReceiptDto[],
    settings: ServerSettings,
  ) {
    const purchase_receipt = payload[0];

    purchase_receipt.naming_series = DEFAULT_NAMING_SERIES.purchase_receipt;
    purchase_receipt.currency = DEFAULT_CURRENCY;
    purchase_receipt.selling_price_list = purchase_receipt.selling_price_list
      ? purchase_receipt.selling_price_list
      : settings.sellingPriceList;
    purchase_receipt.conversion_rate = purchase_receipt.conversion_rate
      ? purchase_receipt.conversion_rate
      : 1;
    purchase_receipt.set_posting_time = 1;
    purchase_receipt.status = purchase_receipt.status
      ? purchase_receipt.status
      : 'To Bill';
    purchase_receipt.items[0].base_total = purchase_receipt.items[0].amount;
    purchase_receipt.items[0].uom = purchase_receipt.items[0].uom
      ? purchase_receipt.items[0].uom
      : 'Nos';
    purchase_receipt.items[0].description = purchase_receipt.items[0]
      .description
      ? purchase_receipt.items[0].description
      : purchase_receipt.items[0].item_name;
    purchase_receipt.items[0].stock_uom = purchase_receipt.items[0].stock_uom
      ? purchase_receipt.items[0].stock_uom
      : 'Nos';
    purchase_receipt.items[0].conversion_factor = purchase_receipt.items[0]
      .conversion_factor
      ? purchase_receipt.items[0].conversion_factor
      : 1;
    return purchase_receipt;
  }

  linkPurchaseWarranty(
    payload: PurchaseReceiptDto[],
    doc: SingleDoctypeResponseInterface,
    token: TokenCache,
    settings: ServerSettings,
    parent: string,
  ) {
    const hash_map: {
      [key: string]: {
        serials?: string[];
        item_name?: string;
        warranty_date?: string;
        warehouse?: string;
      };
    } = {};
    const purchase_receipts: PurchaseReceipt[] = this.mapPurchaseReceiptMetaData(
      payload,
      token,
      parent,
    );
    payload.forEach(receipt => {
      receipt.items.forEach(item => {
        if (!item.has_serial_no) {
          return;
        }
        if (!hash_map[item.item_code]) {
          hash_map[item.item_code] = { serials: [] };
        }

        if (typeof item.serial_no === 'string') {
          hash_map[item.item_code].serials.push(...item.serial_no.split('\n'));
        } else {
          hash_map[item.item_code].serials.push(...item.serial_no);
        }
        hash_map[item.item_code].warranty_date = item.warranty_date;
        hash_map[item.item_code].warehouse = item.warehouse;
        hash_map[item.item_code].item_name = item.item_name;
      });
    });

    this.purchaseReceiptService
      .insertMany(purchase_receipts)
      .then(success => {})
      .catch(err => {});
    const warrantyPurchasedOn = DateTime.fromJSDate(
      getParsedPostingDate(payload[0]),
    )
      .setZone(settings.timeZone)
      .toJSDate();

    this.createStockLedger(payload, token, settings).subscribe();

    if (!Object.keys(hash_map).length) {
      return this.updateInvoiceDeliveredState(doc.name, token.fullName, parent);
    }

    return from(Object.keys(hash_map)).pipe(
      mergeMap(key => {
        const serialHistory: SerialNoHistoryInterface = {};
        serialHistory.created_by = token.fullName;
        serialHistory.created_on = warrantyPurchasedOn;
        serialHistory.document_no = doc.name;
        serialHistory.readable_document_no = payload[0].purchase_invoice_name;
        serialHistory.document_type = PURCHASE_RECEIPT_DOCTYPE_NAME;
        serialHistory.eventDate = new DateTime(settings.timeZone);
        serialHistory.eventType = EventType.SerialPurchased;
        serialHistory.parent_document = parent;
        serialHistory.transaction_from = payload[0].supplier;
        serialHistory.transaction_to = hash_map[key].warehouse;
        return from(
          this.serialNoService.updateMany(
            { serial_no: { $in: hash_map[key].serials } },
            {
              $set: {
                purchase_invoice_name: parent,
                warehouse: hash_map[key].warehouse,
                purchase_document_type: PURCHASE_RECEIPT_DOCTYPE_NAME,
                purchase_document_no: doc.name,
                'warranty.purchaseWarrantyDate': hash_map[key].warranty_date,
                'warranty.purchasedOn': warrantyPurchasedOn,
                item_name: hash_map[key].item_name,
              },
              $unset: { 'queue_state.purchase_receipt': undefined },
            },
          ),
        ).pipe(
          switchMap(done => {
            return this.serialNoHistoryService.addSerialHistory(
              hash_map[key].serials,
              serialHistory,
            );
          }),
        );
      }),
      toArray(),
      switchMap(done => {
        return this.updateInvoiceDeliveredState(
          doc.name,
          token.fullName,
          parent,
        );
      }),
    );
  }

  createStockLedger(payload: PurchaseReceiptDto[], token, settings) {
    return from(payload).pipe(
      concatMap(receipt => {
        return from(receipt.items).pipe(
          concatMap(item => {
            // fetch available stock
            const filter_query = [
              ['item_code', 'like', `${item.item_code}`],
              ['warehouse', 'like', `${item.warehouse}`],
              ['actual_qty', '!=', 0],
            ];

            const filter_Obj: any = {};
            filter_query.forEach(element => {
              if (element[0] === 'item_code') {
                filter_Obj['item.item_code'] = element[2];
              }
              if (element[0] === 'warehouse') {
                filter_Obj['_id.warehouse'] = element[2];
              }
              if (element[1] === '!=') {
                filter_Obj.stockAvailability = { $gt: element[2] };
              }
            });
            const obj: any = {
              _id: {
                warehouse: '$warehouse',
                item_code: '$item_code',
              },
              stockAvailability: {
                $sum: '$actual_qty',
              },
            };
            const $group: any = obj;
            const where: any = [];
            where.push({ $group });
            const $lookup: any = {
              from: 'item',
              localField: '_id.item_code',
              foreignField: 'item_code',
              as: 'item',
            };
            where.push({ $lookup });
            const $unwind: any = '$item';
            where.push({ $unwind });
            const $match: any = filter_Obj;
            where.push({ $match });

            return this.stockLedgerService.asyncAggregate(where).pipe(
              switchMap(data => {
                // fetch pre valuation rate of item for recent perchase into particular warehouse
                const where = [];
                const ledger_filter_obj = {
                  item_code: `${item.item_code}`,
                  warehouse: `${item.warehouse}`,
                  actual_qty: { $gt: 0 },
                };
                const $match: any = ledger_filter_obj;
                where.push({ $match });
                const $sort: any = {
                  modified: -1,
                };
                where.push({ $sort });
                return this.stockLedgerService.asyncAggregate(where).pipe(
                  switchMap((latest_stock_ledger: StockLedger) => {
                    return this.createStockLedgerPayload(
                      {
                        pr_no: receipt.purchase_invoice_name,
                        purchaseReceipt: item,
                      },
                      token,
                      settings,
                      data,
                      latest_stock_ledger,
                    ).pipe(
                      switchMap((response: StockLedger) => {
                        return from(this.stockLedgerService.create(response));
                      }),
                    );
                  }),
                );
              }),
            );
          }),
          toArray(),
        );
      }),
      toArray(),
    );
  }

  createStockLedgerPayload(
    payload: { pr_no: string; purchaseReceipt: PurchaseReceiptItemDto },
    token,
    settings: ServerSettings,
    data,
    latest_stock_ledger,
  ) {
    let pre_valuation_rate;
    let available_stock;
    let pre_incoming_rate;
    if (latest_stock_ledger && latest_stock_ledger.length > 0) {
      pre_valuation_rate = latest_stock_ledger[0].valuation_rate;
      pre_incoming_rate = latest_stock_ledger[0].incoming_rate;
    } else {
      pre_valuation_rate = payload.purchaseReceipt.rate;
      pre_incoming_rate = payload.purchaseReceipt.rate;
    }
    if (data && data.length > 0) {
      available_stock = data[0].stockAvailability;
    } else {
      available_stock = 0;
    }
    const new_quantity = payload.purchaseReceipt.qty + available_stock;

    return this.settingsService.getFiscalYear(settings).pipe(
      switchMap(fiscalYear => {
        const date = new DateTime(settings.timeZone).toJSDate();
        const stockPayload = new StockLedger();
        stockPayload.name = uuidv4();
        stockPayload.modified = date;
        stockPayload.modified_by = token.email;
        stockPayload.warehouse = payload.purchaseReceipt.warehouse;
        stockPayload.item_code = payload.purchaseReceipt.item_code;
        stockPayload.actual_qty = payload.purchaseReceipt.qty;
        stockPayload.incoming_rate = payload.purchaseReceipt.rate;

        if (pre_incoming_rate !== stockPayload.incoming_rate) {
          stockPayload.valuation_rate = parseFloat(
            this.calculateValuationRate(
              available_stock,
              stockPayload.actual_qty,
              stockPayload.incoming_rate,
              pre_valuation_rate,
              new_quantity,
            ),
          );
        } else {
          stockPayload.valuation_rate = pre_valuation_rate;
        }
        stockPayload.balance_qty = new_quantity;
        stockPayload.balance_value = parseFloat(
          (stockPayload.balance_qty * stockPayload.valuation_rate).toFixed(2),
        );
        stockPayload.batch_no = '';
        stockPayload.stock_uom = payload.purchaseReceipt.stock_uom;
        stockPayload.posting_date = date;
        stockPayload.posting_time = date;
        stockPayload.voucher_type = PURCHASE_RECEIPT_DOCTYPE_NAME;
        stockPayload.voucher_no = payload.pr_no;
        stockPayload.voucher_detail_no = '';
        stockPayload.outgoing_rate = 0;
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
  // function for calculate valuation
  calculateValuationRate(
    preQty,
    incomingQty,
    incomingRate,
    preValuation,
    totalQty,
  ) {
    const result =
      (preQty * preValuation + incomingQty * incomingRate) / totalQty;
    return result.toFixed(2);
  }

  updateInvoiceDeliveredState(docName, fullName, parent) {
    return from(
      this.purchaseInvoiceService.updateOne(
        { name: parent },
        {
          $push: { purchase_receipt_names: docName },
          $addToSet: { deliveredBy: fullName },
        },
      ),
    );
  }

  addToQueueNow(data: {
    payload: any;
    token: any;
    settings: any;
    purchase_invoice_name: string;
    type?: string;
    parent?: string;
    status?: string;
  }) {
    data.type = CREATE_PURCHASE_RECEIPT_JOB;
    for (const element of data.payload) {
      if (typeof element.items[0].serial_no !== 'string') {
        try {
          element.items[0].serial_no = element.items[0].serial_no.join('\n');
        } catch {}
      }
    }
    data.parent = data.purchase_invoice_name;
    data.status = AGENDA_JOB_STATUS.in_queue;
    this.agenda
      .now(FRAPPE_QUEUE_JOB, data)
      .then(success => {})
      .catch(err => {});
  }

  mapPurchaseReceiptMetaData(
    purchaseReceipt,
    token,
    purchase_invoice_name,
  ): PurchaseReceipt[] {
    const purchase_receipt_list = [];
    purchaseReceipt.forEach(reciept => {
      reciept.items.forEach(item => {
        const purchase_receipt: any = {};
        purchase_receipt.purchase_document_type = PURCHASE_RECEIPT_DOCTYPE_NAME;
        purchase_receipt.purchase_document_no = purchaseReceipt.name;
        purchase_receipt.purchase_invoice_name = purchase_invoice_name;
        purchase_receipt.amount = item.amount;
        purchase_receipt.cost_center = item.cost_center;
        purchase_receipt.expense_account = item.expense_account;
        purchase_receipt.item_code = item.item_code;
        purchase_receipt.item_name = item.item_name;
        purchase_receipt.qty = item.qty;
        purchase_receipt.rate = item.rate;
        purchase_receipt.warehouse = item.warehouse;
        if (item.serial_no) {
          purchase_receipt.serial_no = item.serial_no.split('\n');
        }
        purchase_receipt.deliveredBy = token.fullName;
        purchase_receipt.deliveredByEmail = token.email;
        purchase_receipt_list.push(purchase_receipt);
      });
    });
    return purchase_receipt_list;
  }
}
