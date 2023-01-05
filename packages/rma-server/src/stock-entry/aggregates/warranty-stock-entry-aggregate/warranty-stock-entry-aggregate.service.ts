import { Injectable, BadRequestException } from '@nestjs/common';
import { StockEntryService } from '../../entities/stock-entry.service';
import { from, throwError, of, forkJoin } from 'rxjs';
import {
  CANCEL_WARRANTY_STOCK_ENTRY,
  DELIVERY_STATUS,
  INVALID_PROGRESS_STATE,
  INVALID_STOCK_ENTRY_STATUS,
  NON_SERIAL_ITEM,
  STOCK_ENTRY,
  STOCK_ENTRY_STATUS,
  VERDICT,
  WARRANTY_CLAIM_DOCTYPE,
  WARRANTY_TYPE,
} from '../../../constants/app-strings';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { ServerSettings } from '../../../system-settings/entities/server-settings/server-settings.entity';
import { WarrantyStockEntryDto } from '../../entities/warranty-stock-entry-dto';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { StockEntry } from '../../entities/stock-entry.entity';
import { switchMap, map, toArray, concatMap, catchError } from 'rxjs/operators';
import { WarrantyClaimService } from '../../../warranty-claim/entity/warranty-claim/warranty-claim.service';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import {
  EventType,
  SerialNoHistoryInterface,
} from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { StockEntryPoliciesService } from '../../../stock-entry/policies/stock-entry-policies/stock-entry-policies.service';
import { WarrantyClaimAggregateService } from '../../../warranty-claim/aggregates/warranty-claim-aggregate/warranty-claim-aggregate.service';
import { PROGRESS_STATUS } from '../../../constants/app-strings';
import { StockLedger } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.entity';
import { StockLedgerService } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.service';

@Injectable()
export class WarrantyStockEntryAggregateService {
  constructor(
    private readonly stockEntryService: StockEntryService,
    private readonly settingService: SettingsService,
    private readonly serialService: SerialNoService,
    private readonly warrantyService: WarrantyClaimService,
    private readonly serialNoHistoryService: SerialNoHistoryService,
    private readonly stockEntryPoliciesService: StockEntryPoliciesService,
    private readonly warrantyAggregateService: WarrantyClaimAggregateService,
    private readonly stockLedgerService: StockLedgerService,
  ) {}

  createDeliveryNote(deliveryNotes: WarrantyStockEntryDto[], req: any) {
    const warrantyPayload: any = {};
    let deliveryNotesList: any[] = [];
    let settingState = {} as ServerSettings;
    const stockId: string[] = [];
    return from(deliveryNotes).pipe(
      concatMap(singleDeliveryNote => {
        Object.assign(warrantyPayload, singleDeliveryNote);
        return forkJoin({
          deliveryNote: of(singleDeliveryNote),
          validStockEntry: this.stockEntryPoliciesService.validateWarrantyStockEntry(
            warrantyPayload,
          ),
          validSerials: this.stockEntryPoliciesService.validateWarrantyStockSerials(
            warrantyPayload,
          ),
          warrantyPayload: of(warrantyPayload),
          settings: this.settingService.find(),
        });
      }),
      toArray(),
      switchMap(settings => {
        return from(deliveryNotes).pipe(
          concatMap((deliveryNote, index) => {
            deliveryNote.status = undefined;
            deliveryNote.stock_voucher_number = uuidv4();
            return this.makeStockEntry(
              deliveryNote,
              req,
              settings.find(x => x.settings).settings,
            ).pipe(
              map((res: any) => {
                stockId[index] = res.ops[0].stock_id;
                return res.ops[0];
              }),
              switchMap(() => {
                return this.updateProgressState(deliveryNote);
              }),
            );
          }),
          toArray(),
        );
      }),
      switchMap(() => {
        return forkJoin({
          warranty: from(
            this.warrantyService.findOne({
              uuid: warrantyPayload.warrantyClaimUuid,
            }),
          ),
          settings: this.settingService.find(),
        }).pipe(
          switchMap(({ warranty, settings }) => {
            if (warranty.serial_no === undefined) {
              warranty.serial_no = '';
            }
            deliveryNotesList = warranty.progress_state;
            settingState = settings;
            return from(deliveryNotesList).pipe(
              concatMap(deliveryNote => {
                return this.updateSerials(
                  deliveryNote,
                  warranty.serial_no,
                  settings,
                );
              }),
              toArray(),
            );
          }),
        );
      }),
      switchMap(() => {
        return from(deliveryNotesList).pipe(
          concatMap((deliveryNote, index) => {
            return this.createSerialNoHistory(
              deliveryNote,
              stockId[index],
              settingState,
              req,
            );
          }),
          toArray(),
        );
      }),
      switchMap(() => {
        return from(deliveryNotesList).pipe(
          concatMap(deliveryNote => {
            return this.syncProgressState(
              warrantyPayload.warrantyClaimUuid,
              deliveryNote,
            );
          }),
          toArray(),
        );
      }),
      switchMap(() => {
        return from(deliveryNotes).pipe(
          concatMap(deliveryNote => {
            return this.createStockLedger(
              deliveryNote,
              req.token,
              settingState,
              stockId,
            );
          }),
        );
      }),
      catchError(err => {
        return throwError(new BadRequestException(err));
      }),
    );
  }

  makeStatusHistory(uuid: string, req: any) {
    return forkJoin({
      warranty: this.warrantyService.findOne(uuid),
      settingState: this.settingService.find(),
    }).pipe(
      switchMap(claim => {
        if (
          claim.warranty.status_history[
            claim.warranty.status_history.length - 1
          ].verdict === VERDICT.DELIVER_TO_CUSTOMER
        ) {
          return throwError(
            new BadRequestException('Stock Entries Already Finalized'),
          );
        }
        this.serialNoHistoryService.updateMany(
          {
            document_no: { $eq: claim.warranty.claim_no },
          },
          {
            $set: {
              eventType: VERDICT.DELIVER_TO_CUSTOMER,
            },
          },
        );
        const statusHistoryDetails = {} as any;
        statusHistoryDetails.uuid = claim.warranty.uuid;
        statusHistoryDetails.time = claim.warranty.posting_time;
        statusHistoryDetails.posting_date = new DateTime(
          claim.settingState.timeZone,
        ).toFormat('yyyy-MM-dd');
        statusHistoryDetails.status_from = req.token.territory[0];
        statusHistoryDetails.verdict = VERDICT.DELIVER_TO_CUSTOMER;
        statusHistoryDetails.description =
          claim.warranty.progress_state[0].description;
        statusHistoryDetails.created_by_email = req.token.email;
        statusHistoryDetails.created_by = req.token.name;
        switch (claim.warranty.progress_state[0].type) {
          case PROGRESS_STATUS.REPLACE:
            statusHistoryDetails.delivery_status = DELIVERY_STATUS.REPLACED;
            break;
          case PROGRESS_STATUS.UPGRADE:
            statusHistoryDetails.delivery_status = DELIVERY_STATUS.UPGRADED;
            break;
          case PROGRESS_STATUS.SPARE_PARTS:
            statusHistoryDetails.delivery_status = DELIVERY_STATUS.REPAIRED;
            break;
          default:
            return throwError(new BadRequestException(INVALID_PROGRESS_STATE));
        }
        return this.warrantyAggregateService.addStatusHistory(
          statusHistoryDetails,
          req,
        );
      }),
      switchMap(() => {
        return from(
          this.warrantyService.updateOne(uuid, {
            $set: {
              delivery_branch: req.token.territory[0],
            },
          }),
        );
      }),
      catchError(err => {
        return throwError(new BadRequestException(err));
      }),
    );
  }

  createStockLedger(payload, token, settings: ServerSettings, stockId) {
    return this.createStockLedgerPayload(
      payload,
      token,
      settings,
      stockId,
    ).pipe(
      switchMap((stockLedgers: StockLedger[]) => {
        return from(stockLedgers).pipe(
          switchMap(stockLedger => {
            return from(this.stockLedgerService.create(stockLedger));
          }),
        );
      }),
    );
  }

  createStockLedgerPayload(res, token, settings: ServerSettings, stockId) {
    return this.settingService.getFiscalYear(settings).pipe(
      switchMap(fiscalYear => {
        const date = new DateTime(settings.timeZone).toJSDate();
        return from(res.items).pipe(
          concatMap((item: any) => {
            // fetch total qty in warehouse
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
                {
                  $match: {
                    'item.item_code': `${item.item_code}`,
                    '_id.warehouse': `${item.s_warehouse}`,
                    stockAvailability: { $gt: 0 },
                  },
                },
                {
                  $unwind: '$item',
                },
              ])
              .pipe(
                switchMap(data => {
                  let available_stock = data[0]?.stockAvailability
                    ? data[0].stockAvailability
                    : 0;

                  // Returned
                  if (res.stock_entry_type === STOCK_ENTRY_STATUS.returned) {
                    let current_valuation_rate;
                    let new_quantity;
                    let pre_incoming_rate;
                    let incoming_rate;

                    // fetch created invoice
                    return this.stockLedgerService
                      .asyncAggregate([
                        {
                          $match: {
                            voucher_no: `${item.sales_invoice_name}`,
                          },
                        },
                      ])
                      .pipe(
                        switchMap((created_sales_invoice: StockLedger) => {
                          // fetch current valuation of warehouse
                          return this.stockLedgerService
                            .asyncAggregate([
                              {
                                $match: {
                                  item_code: `${item.item_code}`,
                                  warehouse: `${item.s_warehouse}`,
                                  actual_qty: { $gt: 0 },
                                },
                              },
                              {
                                $sort: {
                                  modified: -1,
                                },
                              },
                            ])
                            .pipe(
                              switchMap(latest_stock_ledger => {
                                const stockPayload = new StockLedger();

                                // treated as sold from our warehouse
                                if (
                                  Object.keys(created_sales_invoice).length > 0
                                ) {
                                  incoming_rate = created_sales_invoice[0]
                                    ?.valuation_rate
                                    ? created_sales_invoice[0].valuation_rate
                                    : latest_stock_ledger[0].valuation_rate;
                                  stockPayload.incoming_rate = incoming_rate
                                    ? incoming_rate
                                    : 0;
                                  current_valuation_rate = latest_stock_ledger[0]
                                    ?.valuation_rate
                                    ? latest_stock_ledger[0].valuation_rate
                                    : incoming_rate;
                                  pre_incoming_rate = latest_stock_ledger[0]
                                    ?.incoming_rate
                                    ? latest_stock_ledger[0].incoming_rate
                                    : 0;
                                }
                                // treated as third party
                                else {
                                  current_valuation_rate = latest_stock_ledger[0]
                                    ?.valuation_rate
                                    ? latest_stock_ledger[0].valuation_rate
                                    : incoming_rate;
                                  pre_incoming_rate = latest_stock_ledger[0]
                                    ?.incoming_rate
                                    ? latest_stock_ledger[0].incoming_rate
                                    : incoming_rate;
                                  stockPayload.incoming_rate = current_valuation_rate
                                    ? current_valuation_rate
                                    : 0;
                                }
                                new_quantity = available_stock + item.qty;

                                stockPayload.name = uuidv4();
                                stockPayload.modified = date;
                                stockPayload.modified_by = token.email;
                                // ledger will not be made on cancellation we can remove cancellation work
                                if (
                                  res.action === CANCEL_WARRANTY_STOCK_ENTRY
                                ) {
                                  stockPayload.voucher_no = res.stock_id;
                                  if (item.qty < 0) {
                                    item.qty = -item.qty;
                                  }
                                  stockPayload.actual_qty = -item.qty;
                                  stockPayload.valuation_rate =
                                    stockPayload.incoming_rate;
                                  stockPayload.batch_no = '';
                                } else {
                                  stockPayload.actual_qty = 1;
                                  if (
                                    pre_incoming_rate !==
                                    stockPayload.incoming_rate
                                  ) {
                                    stockPayload.valuation_rate = parseFloat(
                                      this.calculateValuationRate(
                                        available_stock,
                                        stockPayload.actual_qty,
                                        stockPayload.incoming_rate,
                                        current_valuation_rate,
                                        new_quantity,
                                      ),
                                    );
                                  } else {
                                    stockPayload.valuation_rate = current_valuation_rate;
                                  }
                                  stockPayload.actual_qty = item.qty;
                                  stockPayload.voucher_no = stockId;
                                  stockPayload.batch_no = '';
                                }
                                stockPayload.warehouse = item?.s_warehouse
                                  ? item.s_warehouse
                                  : item.warehouse;
                                stockPayload.balance_qty = new_quantity;
                                stockPayload.balance_value = parseFloat(
                                  (
                                    stockPayload.balance_qty *
                                    stockPayload.valuation_rate
                                  ).toFixed(2),
                                );
                                stockPayload.item_code = item.item_code;
                                stockPayload.posting_date = date;
                                stockPayload.posting_time = date;
                                stockPayload.voucher_type = STOCK_ENTRY;
                                stockPayload.voucher_detail_no = '';
                                stockPayload.outgoing_rate = 0;
                                stockPayload.company = settings.defaultCompany;
                                stockPayload.fiscal_year = fiscalYear;
                                return of(stockPayload);
                              }),
                            );
                        }),
                      );
                  }
                  // Delivered
                  if (res.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
                    // fetch current valuation of wrehouse
                    return this.stockLedgerService
                      .asyncAggregate([
                        {
                          $match: {
                            item_code: `${item.item_code}`,
                            warehouse: `${item.s_warehouse}`,
                            actual_qty: { $gt: 0 },
                          },
                        },
                        {
                          $sort: {
                            modified: -1,
                          },
                        },
                      ])
                      .pipe(
                        switchMap(latest_stock_ledger => {
                          const stockPayload = new StockLedger();
                          stockPayload.name = uuidv4();
                          stockPayload.modified = date;
                          stockPayload.modified_by = token.email;
                          // ledger will not be made on cancellation we can remove cancellation work
                          if (res.action === CANCEL_WARRANTY_STOCK_ENTRY) {
                            stockPayload.voucher_no = res.stock_id;
                            stockPayload.actual_qty = item.qty;
                            stockPayload.batch_no = '';
                            stockPayload.incoming_rate = 0;
                          } else {
                            stockPayload.actual_qty = -item.qty;
                            stockPayload.voucher_no = stockId;
                            stockPayload.batch_no = '';
                            stockPayload.incoming_rate = 0;
                          }
                          stockPayload.warehouse = item?.s_warehouse
                            ? item.s_warehouse
                            : item.warehouse;
                          stockPayload.item_code = item.item_code;
                          if (
                            latest_stock_ledger &&
                            latest_stock_ledger[0]?.valuation_rate > 0
                          ) {
                            stockPayload.valuation_rate =
                              latest_stock_ledger[0].valuation_rate;
                          } else {
                            stockPayload.valuation_rate = 0;
                          }
                          stockPayload.balance_qty = available_stock - item.qty;
                          stockPayload.balance_value = parseFloat(
                            (
                              stockPayload.balance_qty *
                              stockPayload.valuation_rate
                            ).toFixed(2),
                          );
                          stockPayload.posting_date = date;
                          stockPayload.posting_time = date;
                          stockPayload.voucher_type = STOCK_ENTRY;
                          stockPayload.voucher_detail_no = '';

                          stockPayload.outgoing_rate = 0;
                          stockPayload.company = settings.defaultCompany;
                          stockPayload.fiscal_year = fiscalYear;
                          return of(stockPayload);
                        }),
                      );
                  }
                }),
              );
          }),
          toArray(),
          switchMap(data => {
            return of(data);
          }),
        );
      }),
    );
  }

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

  makeStockEntry(
    deliveryNote: WarrantyStockEntryDto,
    req: any,
    settings: ServerSettings,
  ) {
    const stockEntry: StockEntry = this.setStockEntryDefaults(
      deliveryNote,
      req,
      settings,
    );
    stockEntry.items[0].serial_no = deliveryNote.items[0].serial_no;
    return this.getAssignStockId(stockEntry, settings).pipe(
      switchMap((stockEntryPayload: StockEntry) => {
        return from(this.stockEntryService.create(stockEntryPayload));
      }),
    );
  }

  updateProgressState(deliveryNote: any) {
    deliveryNote.isSync = false;
    let serialData = {} as any;
    switch (deliveryNote.stock_entry_type) {
      case STOCK_ENTRY_STATUS.returned:
        serialData = {
          damaged_serial: deliveryNote.items[0].serial_no,
          damage_warehouse: deliveryNote.items[0].s_warehouse,
          damage_product: deliveryNote.items[0].item_name,
        };
        break;
      case STOCK_ENTRY_STATUS.delivered:
        serialData = {
          replace_serial: deliveryNote.items[0].serial_no,
          replace_warehouse: deliveryNote.items[0].s_warehouse,
          replace_product: deliveryNote.items[0].item_name,
        };
        break;
      default:
        return throwError(new BadRequestException(INVALID_STOCK_ENTRY_STATUS));
    }
    return from(
      this.warrantyService.updateOne(
        { uuid: deliveryNote.warrantyClaimUuid },
        {
          $push: {
            progress_state: deliveryNote,
          },
          $set: serialData,
        },
      ),
    );
  }

  createSerialNoHistory(
    deliveryNote: any,
    stockId: string,
    settings: ServerSettings,
    req: any,
  ) {
    if (deliveryNote.isSync) {
      return of({});
    }
    const serialHistory: SerialNoHistoryInterface = {};
    serialHistory.naming_series = deliveryNote.naming_series;
    serialHistory.serial_no = deliveryNote.items[0].serial_no[0];
    serialHistory.created_by = req.token.fullName;
    serialHistory.created_on = new DateTime(settings.timeZone).toJSDate();
    serialHistory.document_no = deliveryNote.stock_voucher_number;

    serialHistory.readable_document_no = stockId;

    serialHistory.document_type = WARRANTY_CLAIM_DOCTYPE;
    serialHistory.eventDate = new DateTime(settings.timeZone);
    serialHistory.parent_document = deliveryNote.warrantyClaimUuid;
    switch (deliveryNote.stock_entry_type) {
      case STOCK_ENTRY_STATUS.returned:
        const verdict = Object.keys(VERDICT).find(
          key => VERDICT[key] === VERDICT.RECEIVED_FROM_CUSTOMER,
        );
        const event = EventType[verdict];
        serialHistory.eventType = event;
        serialHistory.transaction_from = deliveryNote.customer;
        serialHistory.transaction_to = !deliveryNote.items[0].warehouse
          ? deliveryNote.customer
          : deliveryNote.items[0].warehouse;
        break;
      case STOCK_ENTRY_STATUS.delivered:
        const verdict_key = Object.keys(VERDICT).find(
          key => VERDICT[key] === VERDICT.DELIVER_TO_CUSTOMER,
        );
        const eventType = EventType[verdict_key];
        serialHistory.eventType = eventType;
        serialHistory.transaction_from = req.token.territory[0];
        serialHistory.transaction_to = !deliveryNote.customer
          ? req.token.territory[0]
          : deliveryNote.customer;
        break;
      default:
        break;
    }
    return this.serialNoHistoryService.addSerialHistory(
      [deliveryNote.items[0].serial_no],
      serialHistory,
    );
  }

  syncProgressState(uuid: string, deliveryNote: any) {
    return from(
      this.warrantyService.updateOne(
        {
          uuid,
          'progress_state.stock_voucher_number':
            deliveryNote.stock_voucher_number,
        },
        {
          $set: {
            'progress_state.$.isSync': true,
          },
        },
      ),
    );
  }

  updateSerials(
    deliveryNote: any,
    serial_no: string,
    settings: ServerSettings,
  ) {
    if (deliveryNote.isSync) {
      return of(true);
    }
    if (
      deliveryNote.items[0].serial_no &&
      deliveryNote.stock_entry_type === STOCK_ENTRY_STATUS.delivered
    ) {
      deliveryNote.delivery_note = deliveryNote.stock_voucher_number;
      return this.updateSerialItem(deliveryNote, serial_no, settings);
    }
    deliveryNote.delivery_note = deliveryNote.stock_voucher_number;
    return from(
      this.serialService.updateOne(
        { serial_no: deliveryNote.items[0].serial_no },
        {
          $set: {
            delivery_note: deliveryNote.stock_voucher_number,
            warehouse: deliveryNote.set_warehouse,
          },
          $unset: {
            customer: '',
            'warranty.salesWarrantyDate': '',
            'warranty.soldOn': '',
            sales_invoice_name: '',
          },
        },
      ),
    );
  }

  updateSerialItem(payload: any, serial_no: string, settings: ServerSettings) {
    return from(
      this.warrantyService.findOne(
        { uuid: payload.warrantyClaimUuid },
        {
          progress_state: {
            $elemMatch: {
              items: {
                $elemMatch: {
                  serial_no,
                },
              },
            },
          },
        },
      ),
    ).pipe(
      switchMap(state => {
        return from(
          this.serialService.updateOne(
            { serial_no: payload.items[0].serial_no },
            {
              $set: {
                customer: state.progress_state[0].customer,
                'warranty.salesWarrantyDate': state.warranty_end_date
                  ? state.warranty_end_date
                  : '',
                'warranty.soldOn': new DateTime(settings.timeZone).toJSDate(),
                sales_invoice_name: state.progress_state[0].sales_invoice_name,
                delivery_note: payload.delivery_note,
              },
            },
          ),
        );
      }),
    );
  }

  setStockEntryDefaults(
    payload: WarrantyStockEntryDto,
    clientHttpRequest,
    settings: ServerSettings,
  ): StockEntry {
    const stockEntry = new StockEntry();
    Object.assign(stockEntry, payload);
    stockEntry.uuid = uuidv4();
    stockEntry.doctype = STOCK_ENTRY;
    stockEntry.createdOn = payload.posting_date;
    stockEntry.createdAt = new DateTime(settings.timeZone).toJSDate();
    stockEntry.createdByEmail = clientHttpRequest.token.email;
    stockEntry.createdBy = clientHttpRequest.token.fullName;
    stockEntry.stock_voucher_number = payload.stock_voucher_number;
    stockEntry.status = STOCK_ENTRY_STATUS.in_transit;
    stockEntry.isSynced = false;
    stockEntry.inQueue = true;
    stockEntry.docstatus = 1;
    return stockEntry;
  }

  removeStockEntry(uuid: string, req) {
    return from(this.stockEntryService.findOne(uuid)).pipe(
      switchMap(stockEntry => {
        return this.stockEntryPoliciesService
          .validateCancelWarrantyStockEntry(
            stockEntry.warrantyClaimUuid,
            this.getSerialString(stockEntry.items.find(x => x).serial_no),
          )
          .pipe(
            switchMap(() => {
              if (
                this.getSerialString(
                  stockEntry.items.find(x => x).serial_no,
                ) === NON_SERIAL_ITEM
              ) {
                // for NON SERIAL ITEM
                this.stockEntryService.deleteOne({
                  uuid: stockEntry.uuid,
                });
                this.warrantyService.updateOne(
                  { uuid: stockEntry.warrantyClaimUuid },
                  {
                    $unset: {
                      damage_product: '',
                      damage_warehouse: '',
                      damaged_serial: '',
                    },
                  },
                );
              } else {
                // for SERIAL ITEM
                if (
                  stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.delivered
                ) {
                  return from(
                    this.serialService.updateOne(
                      {
                        serial_no: stockEntry.items.find(x => x)?.serial_no,
                      },
                      {
                        $unset: {
                          customer: undefined,
                          'warranty.salesWarrantyDate': undefined,
                          'warranty.soldOn': undefined,
                          delivery_note: undefined,
                          sales_invoice_name: undefined,
                          sales_return_name: undefined,
                        },
                      },
                    ),
                  );
                }
                if (
                  stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.returned
                ) {
                  return this.resetCancelledSerialItem(stockEntry);
                }
                return of(true);
              }
              return of(true);
            }),
            switchMap(() => {
              return from(
                this.warrantyService.findOne({
                  uuid: stockEntry.warrantyClaimUuid,
                }),
              );
            }),
            switchMap(warranty => {
              // DELETE SERIAL HISTORY OF WSD
              if (
                stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.delivered
              ) {
                warranty.progress_state.forEach(state => {
                  state.items.forEach(element => {
                    if (
                      element.stock_entry_type === STOCK_ENTRY_STATUS.delivered
                    ) {
                      this.serialNoHistoryService.deleteOne({
                        document_no: state.stock_voucher_number,
                      });
                    }
                  });
                });
                return from(
                  this.warrantyService.updateOne(
                    { uuid: stockEntry.warrantyClaimUuid },
                    {
                      $unset: {
                        replace_warehouse: '',
                        replace_product: '',
                        replace_serial: '',
                      },
                    },
                  ),
                );
              }
              // DELETE SERIAL HISTORY OF WSDR
              else if (
                stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.returned
              ) {
                warranty.progress_state.forEach(state => {
                  state.items.forEach(element => {
                    if (
                      element.stock_entry_type === STOCK_ENTRY_STATUS.returned
                    ) {
                      this.serialNoHistoryService.deleteOne({
                        document_no: state.stock_voucher_number,
                      });
                    }
                  });
                });
              }
              return of([]);
            }),
            switchMap(() => {
              return from(
                this.stockEntryService.deleteOne({
                  uuid: stockEntry.uuid,
                }),
              );
            }),
            switchMap(() => {
              return this.revertStatusHistory(stockEntry.warrantyClaimUuid);
            }),
            switchMap(() => {
              return from(
                this.warrantyService.updateOne(
                  { uuid: stockEntry.warrantyClaimUuid },
                  {
                    $pull: {
                      progress_state: {
                        stock_voucher_number: stockEntry.stock_voucher_number,
                      },
                    },
                  },
                ),
              );
            }),
            switchMap(() => {
              if (
                stockEntry.items.some(
                  item =>
                    this.getSerialString(item.serial_no) !== NON_SERIAL_ITEM,
                )
              ) {
                return from(
                  this.serialNoHistoryService.deleteOne({
                    document_no: stockEntry.stock_voucher_number,
                  }),
                );
              }
              return of(true);
            }),
            switchMap(() => {
              return from(
                this.stockLedgerService.deleteOne({
                  voucher_no: stockEntry.stock_id,
                }),
              );
            }),
          );
      }),
    );
  }

  revertStatusHistory(uuid: string) {
    return from(
      this.warrantyService.findOne({
        uuid,
        status_history: {
          $elemMatch: {
            verdict: VERDICT.DELIVER_TO_CUSTOMER,
          },
        },
      }),
    ).pipe(
      switchMap(res => {
        if (!res) {
          return of({});
        }
        return this.warrantyAggregateService.removeStatusHistory({ uuid });
      }),
    );
  }

  resetCancelledSerialItem(stockEntry: StockEntry) {
    return from(
      this.warrantyService.findOne({
        uuid: stockEntry.warrantyClaimUuid,
        claim_type: WARRANTY_TYPE.THIRD_PARTY,
      }),
    ).pipe(
      switchMap(warranty => {
        if (!warranty) {
          return from(
            this.serialService.updateOne(
              {
                serial_no: stockEntry.items.find(x => x).serial_no,
              },
              {
                $set: {
                  customer: stockEntry.customer,
                  warehouse: stockEntry.items[0].warehouse,
                  'warranty.salesWarrantyDate':
                    stockEntry.items[0].warranty?.salesWarrantyDate,
                  'warranty.soldOn': stockEntry.items[0].warranty?.soldOn,
                  sales_invoice_name: stockEntry.items[0].sales_invoice_name,
                  delivery_note: stockEntry.items[0].delivery_note,
                },
              },
            ),
          );
        }
        return from(
          this.serialNoHistoryService.list(
            0,
            1,
            stockEntry.items.find(x => x)?.serial_no,
            { $natural: -1 },
          ),
        ).pipe(
          switchMap(lastSerialEvent => {
            return from(
              this.serialService.updateOne(
                {
                  serial_no: stockEntry.items.find(x => x)?.serial_no,
                },
                {
                  $set: {
                    'warranty.salesWarrantyDate': warranty.received_on,
                    'warranty.soldOn': warranty.received_on,
                    warehouse: lastSerialEvent.docs[0].transaction_to,
                  },
                  $unset: {
                    delivery_note: '',
                  },
                },
              ),
            );
          }),
        );
      }),
    );
  }

  // assigning stock id function
  getAssignStockId(stockPayload: StockEntry, serverSettings: ServerSettings) {
    const date = new DateTime(serverSettings.timeZone).year;
    let $match: any;
    if (stockPayload.stock_entry_type === STOCK_ENTRY_STATUS.returned) {
      $match = {
        stock_entry_type: STOCK_ENTRY_STATUS.returned,
      };
    } else if (stockPayload.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
      $match = {
        stock_entry_type: STOCK_ENTRY_STATUS.delivered,
      };
    }
    const $sort: any = {
      createdAt: -1,
    };
    const $limit: any = 1;
    return this.stockEntryService
      .asyncAggregate([{ $match }, { $sort }, { $limit }])
      .pipe(
        map((result: any) => {
          const myArray = result[0].stock_id.split('-');
          const incrementor = Number(myArray[2]) + 1;
          if (stockPayload.stock_entry_type === STOCK_ENTRY_STATUS.returned) {
            stockPayload.stock_id = `WSDR-${date}-${incrementor}`;
          } else if (
            stockPayload.stock_entry_type === STOCK_ENTRY_STATUS.delivered
          ) {
            stockPayload.stock_id = `WSD-${date}-${incrementor}`;
          }
          return stockPayload;
        }),
      );
  }

  getSerialString(serials): string {
    if (typeof serials === 'object') {
      return serials[0];
    }
    return serials;
  }
}
