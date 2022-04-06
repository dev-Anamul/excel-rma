import { Injectable, NotImplementedException, HttpService, NotFoundException, BadRequestException } from '@nestjs/common';
import { StockEntryService } from '../../entities/stock-entry.service';
import { from, throwError, of, forkJoin } from 'rxjs';
import {
  CURRENT_STATUS_VERDICT,
  DEFAULT_NAMING_SERIES,
  DELIVERY_STATUS,
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
import { POST_DELIVERY_NOTE_ENDPOINT } from '../../../constants/routes';
import { WarrantyStockEntryDto } from '../../entities/warranty-stock-entry-dto';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { StockEntry } from '../../entities/stock-entry.entity';
import { switchMap, map, toArray, concatMap, catchError } from 'rxjs/operators';
import { WarrantyClaimService } from '../../../warranty-claim/entity/warranty-claim/warranty-claim.service';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import { EventType, SerialNoHistoryInterface } from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { StockEntryPoliciesService } from '../../../stock-entry/policies/stock-entry-policies/stock-entry-policies.service';
import { WarrantyClaimAggregateService } from '../../../warranty-claim/aggregates/warranty-claim-aggregate/warranty-claim-aggregate.service';
import { PROGRESS_STATUS } from '../../../constants/app-strings';

@Injectable()
export class WarrantyStockEntryAggregateService {
  constructor(
    private readonly stockEntryService: StockEntryService,
    private readonly settingService: SettingsService,
    private readonly serialService: SerialNoService,
    private readonly http: HttpService,
    private warrantyService: WarrantyClaimService,
    private serialNoHistoryService: SerialNoHistoryService,
    private readonly stockEntryPoliciesService: StockEntryPoliciesService,
    private readonly warrantyAggregateService: WarrantyClaimAggregateService,
  ) {}

  createDeliveryNote(deliveryNotes: WarrantyStockEntryDto[], req) {
    const warrantyPayload: any = {};
    let deliveryNotesList: any[] = [];
    let settingState = {} as ServerSettings;
    return from(deliveryNotes).pipe(
      concatMap(singleDeliveryNote => {
        Object.assign(warrantyPayload, singleDeliveryNote);
        warrantyPayload.items[0].serial_no = warrantyPayload.items[0].serial_no.split();
        return of({
          singleDeliveryNote,
          valid: this.stockEntryPoliciesService.validateWarrantyStockEntry(warrantyPayload, req),
          warrantyPayload,
        });
      }),
      toArray(),
      switchMap(deliveryNoteObject => {
        return this.checkDeliveryNoteState(deliveryNoteObject);
      }),
      switchMap(deliveryNotesObject => {
        if (deliveryNotesObject.length > 0) {
          deliveryNotesList = deliveryNotesObject;
          return this.settingService.find();
        }
        return throwError(new BadRequestException('All stock entries already completed'));
      }),
      switchMap(settings => {
        return from(deliveryNotesList).pipe(
          concatMap(deliveryNote => {
            let erpDN;
            deliveryNote.singleDeliveryNote.status = undefined;
            return this.createERPStockEntry(deliveryNote.singleDeliveryNote, req, settings).pipe(
              map(res => res.data.data),
              switchMap(res => {
                erpDN = res;
                return this.makeStockEntry(res, deliveryNote.singleDeliveryNote, req, settings);
              }),
              map(res => res.ops[0]),
              switchMap(res => {
                return this.updateProgressState(deliveryNote.singleDeliveryNote, erpDN);
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
            deliveryNotesList = warranty.progress_state;
            settingState = settings;
            return from(deliveryNotesList).pipe(
              concatMap(deliveryNote => {
                return this.updateSerials(deliveryNote, warranty.serial_no, settings);
              }),
              toArray(),
            );
          }),
        );
      }),
      switchMap(() => {
        return from(deliveryNotesList).pipe(
          concatMap(deliveryNote => {
            return this.createSerialNoHistory(deliveryNote, settingState, req);
          }),
          toArray(),
        );
      }),
      switchMap(() => {
        return from(deliveryNotesList).pipe(
          concatMap(deliveryNote => {
            return this.syncProgressState(warrantyPayload.warrantyClaimUuid, deliveryNote);
          }),
          toArray(),
        );
      }),
      catchError(err => {
        return throwError(new BadRequestException(err));
      }),
    );
  }

  makeStatusHistory(uuid: string, req) {
    return forkJoin({
      warranty: this.warrantyService.findOne(uuid),
      settingState: this.settingService.find(),
    }).pipe(
      switchMap(claim => {
        if (claim.warranty.status_history[claim.warranty.status_history.length - 1].verdict === VERDICT.DELIVER_TO_CUSTOMER) {
          return throwError(new BadRequestException('Stock Entries Already Finalized'));
        }
        const statusHistoryDetails = {} as any;
        statusHistoryDetails.uuid = claim.warranty.uuid;
        (statusHistoryDetails.time = new DateTime(claim.settingState.timeZone).toFormat('HH:mm:ss')),
          (statusHistoryDetails.posting_date = new DateTime(claim.settingState.timeZone).toFormat('yyyy-MM-dd')),
          (statusHistoryDetails.status_from = req.token.territory[0]);
        statusHistoryDetails.verdict = VERDICT.DELIVER_TO_CUSTOMER;
        statusHistoryDetails.description = claim.warranty.progress_state[0].description;
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
            return throwError(new BadRequestException(`not valid type`));
        }
        return this.warrantyAggregateService.addStatusHistory(statusHistoryDetails, req);
      }),
      switchMap(res => {
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

  makeStockEntry(res, singleDeliveryNote, req, settings) {
    const stockEntry = this.setStockEntryDefaults(singleDeliveryNote, req, settings);
    stockEntry.stock_voucher_number = res.name;
    stockEntry.items[0].serial_no = res.items[0].excel_serials;
    return from(this.stockEntryService.create(stockEntry));
  }

  updateProgressState(deliveryNote, erpDN) {
    deliveryNote.stock_voucher_number = erpDN.name;
    deliveryNote.isSync = false;
    let serialData = {} as any;
    switch (deliveryNote.stock_entry_type) {
      case STOCK_ENTRY_STATUS.returned:
        serialData = {
          damaged_serial: deliveryNote.items[0].serial_no,
          damage_warehouse: deliveryNote.items[0].warehouse,
          damage_product: deliveryNote.items[0].item_name,
        };
        break;
      case STOCK_ENTRY_STATUS.delivered:
        serialData = {
          replace_serial: deliveryNote.items[0].serial_no,
          replace_warehouse: deliveryNote.items[0].warehouse,
          replace_product: deliveryNote.items[0].item_name,
        };
        break;
      default:
        return throwError(new BadRequestException(`not valid type`));
    }
    return from(
      this.warrantyService.updateOne(
        { uuid: deliveryNote.warrantyClaimUuid },
        {
          $push: {
            progress_state: deliveryNote,
            completed_delivery_note: erpDN,
          },
          $set: serialData,
        },
      ),
    );
  }

  createSerialNoHistory(deliveryNote, settings, req) {
    if (deliveryNote.isSync) {
      return of({});
    }
    const serialHistory: SerialNoHistoryInterface = {};
    serialHistory.serial_no = deliveryNote.items[0].excel_serials;
    serialHistory.created_by = req.token.fullName;
    serialHistory.created_on = new DateTime(settings.timeZone).toJSDate();
    serialHistory.document_no = deliveryNote.stock_voucher_number;
    serialHistory.document_type = WARRANTY_CLAIM_DOCTYPE;
    serialHistory.eventDate = new DateTime(settings.timeZone);
    serialHistory.parent_document = deliveryNote.warrantyClaimUuid;
    switch (deliveryNote.stock_entry_type) {
      case STOCK_ENTRY_STATUS.returned:
        const verdict = Object.keys(VERDICT).find(key => VERDICT[key] === VERDICT.RECEIVED_FROM_CUSTOMER);
        const event = EventType[verdict];
        serialHistory.eventType = event;
        serialHistory.transaction_from = deliveryNote.customer;
        serialHistory.transaction_to = !deliveryNote.items[0].warehouse ? deliveryNote.customer : deliveryNote.items[0].warehouse;
        break;
      case STOCK_ENTRY_STATUS.delivered:
        const verdict_key = Object.keys(VERDICT).find(key => VERDICT[key] === VERDICT.DELIVER_TO_CUSTOMER);
        const eventType = EventType[verdict_key];
        serialHistory.eventType = eventType;
        serialHistory.transaction_from = req.token.territory[0];
        serialHistory.transaction_to = !deliveryNote.customer ? req.token.territory[0] : deliveryNote.customer;
        break;
      default:
        break;
    }
    return this.serialNoHistoryService.addSerialHistory([deliveryNote.items[0].excel_serials], serialHistory);
  }

  syncProgressState(uuid, deliveryNote) {
    return from(
      this.warrantyService.updateOne(
        {
          uuid,
          'progress_state.stock_voucher_number': deliveryNote.stock_voucher_number,
        },
        {
          $set: {
            'progress_state.$.isSync': true,
          },
        },
      ),
    );
  }

  updateSerials(deliveryNote, serial_no, settings) {
    if (deliveryNote.isSync) {
      return of(true);
    }
    if (deliveryNote.items[0].excel_serials && deliveryNote.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
      deliveryNote.delivery_note = deliveryNote.stock_voucher_number;
      return this.updateSerialItem(deliveryNote, serial_no, settings);
    }
    deliveryNote.delivery_note = deliveryNote.stock_voucher_number;
    return from(
      this.serialService.updateOne({ serial_no: deliveryNote.items[0].excel_serials }, [
        {
          $set: {
            delivery_note: deliveryNote.stock_voucher_number,
            warehouse: deliveryNote.set_warehouse,
          },
        },
        {
          $unset: ['sales_invoice_name', 'warranty.soldOn'],
        },
      ]),
    );
  }

  checkDeliveryNoteState(deliveryNotesList) {
    const correctDeliveryNotes: WarrantyStockEntryDto[] = [];
    return from(deliveryNotesList).pipe(
      concatMap((deliveryNote: any) => {
        let query;
        if (deliveryNote.singleDeliveryNote.items[0].serial_no[0]) {
          query = {
            uuid: deliveryNote.singleDeliveryNote.warrantyClaimUuid,
            completed_delivery_note: {
              $elemMatch: {
                'items.0.excel_serials': deliveryNote.singleDeliveryNote.items[0].serial_no[0],
                'items.0.item_code': deliveryNote.singleDeliveryNote.items[0].item_code,
              },
            },
          };
        } else {
          query = {
            uuid: deliveryNote.singleDeliveryNote.warrantyClaimUuid,
            completed_delivery_note: {
              $elemMatch: {
                'items.0.item_code': deliveryNote.singleDeliveryNote.items[0].item_code,
              },
            },
          };
        }
        return from(this.warrantyService.find(query)).pipe(
          switchMap(res => {
            if (!res.length) {
              correctDeliveryNotes.push(deliveryNote);
              return of();
            }
            return of();
          }),
        );
      }),
      toArray(),
      switchMap(res => {
        if (correctDeliveryNotes.length) {
          return of(correctDeliveryNotes);
        }
        return of([]);
      }),
    );
  }

  createERPStockEntry(payload, req, settings) {
    const url = `${settings.authServerURL}${POST_DELIVERY_NOTE_ENDPOINT}`;
    const body = this.mapErpItem(payload);
    return this.http.post(url, body, {
      headers: this.settingService.getAuthorizationHeaders(req.token),
    });
  }

  updateSerialItem(payload, serial_no, settings) {
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
            { serial_no: payload.items[0].excel_serials },
            {
              $set: {
                customer: state.progress_state[0].customer,
                'warranty.salesWarrantyDate': state.warranty_end_date ? state.warranty_end_date : '',
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

  mapErpItem(payload) {
    const erpPayload = {} as any;
    Object.assign(erpPayload, payload);
    erpPayload.has_serial_no = 0;
    erpPayload.docstatus = 1;
    erpPayload.items.forEach(item => {
      item.excel_serials = item.serial_no[0];
      item.serial_no = undefined;
      item.price_list_rate = 0;
      item.warehouse = erpPayload.set_warehouse;
      item.rate = 0;
      if (item.stock_entry_type === STOCK_ENTRY_STATUS.returned) {
        erpPayload.return_against = payload.delivery_note;
        erpPayload.naming_series = DEFAULT_NAMING_SERIES.warranty_delivery_return;
        erpPayload.is_return = 1;
        item.qty = -item.qty;
      }
      if (item.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
        erpPayload.naming_series = DEFAULT_NAMING_SERIES.warranty_delivery_note;
      }
    });
    return erpPayload;
  }

  setStockEntryDefaults(payload: WarrantyStockEntryDto, clientHttpRequest, settings: ServerSettings): StockEntry {
    const stockEntry = new StockEntry();
    Object.assign(stockEntry, payload);
    stockEntry.uuid = uuidv4();
    stockEntry.doctype = STOCK_ENTRY;
    stockEntry.createdOn = payload.posting_date;
    stockEntry.createdAt = new DateTime(settings.timeZone).toJSDate();
    stockEntry.createdByEmail = clientHttpRequest.token.email;
    stockEntry.createdBy = clientHttpRequest.token.fullName;
    stockEntry.status = STOCK_ENTRY_STATUS.in_transit;
    stockEntry.isSynced = false;
    stockEntry.inQueue = true;
    stockEntry.docstatus = 1;
    return stockEntry;
  }

  retrieveStockEntry(warrantyClaimUuid: string) {
    return from(this.stockEntryService.findOne(warrantyClaimUuid));
  }

  removeStockEntry(stockEntry: WarrantyStockEntryDto, req) {
    let set: any;
    return this.stockEntryPoliciesService.validateCancelWarrantyStockEntry(stockEntry.warrantyClaimUuid, [stockEntry.items[0]?.serial_no]).pipe(
      switchMap(() => {
        return this.settingService.find();
      }),
      switchMap(settings => {
        if (!settings.authServerURL) {
          return throwError(new NotImplementedException());
        }
        set = settings;
        const url = `${settings.authServerURL}${POST_DELIVERY_NOTE_ENDPOINT}/${stockEntry.stock_voucher_number}`;
        return this.http.get(url, {
          headers: this.settingService.getAuthorizationHeaders(req.token),
        });
      }),
      map(res => res.data.data),
      switchMap(response => {
        if (!response) {
          return throwError(new NotFoundException());
        }
        if (response.docstatus !== 2) {
          const url = `${set.authServerURL}${POST_DELIVERY_NOTE_ENDPOINT}/${stockEntry.stock_voucher_number}`;
          response.docstatus = 2;
          response.items.forEach(item => {
            item.docstatus = 2;
          });
          return this.http.put(url, response, {
            headers: this.settingService.getAuthorizationHeaders(req.token),
          });
        }
        return of({ data: {} });
      }),
      map(res => res.data.data),
      switchMap(serialItem => {
        if (
          stockEntry.items.find(item => {
            if (item.serial_no.toUpperCase() === NON_SERIAL_ITEM) {
              return undefined;
            }
            return item.serial_no;
          })
        ) {
          if (stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
            return from(
              this.serialService.updateOne(
                { serial_no: stockEntry.items[0]?.serial_no },
                {
                  $unset: ['customer', 'warranty.salesWarrantyDate', 'warranty.soldOn', 'delivery_note', 'sales_invoice_name'],
                },
              ),
            );
          }
          if (stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.returned) {
            return this.resetCancelledSerialItem(stockEntry.stock_voucher_number);
          }
          return of(true);
        }
        return of(true);
      }),
      switchMap(() => {
        if (stockEntry.stock_entry_type === STOCK_ENTRY_STATUS.delivered) {
          return from(
            this.warrantyService.updateOne(
              { uuid: stockEntry.warrantyClaimUuid },
              {
                $unset: ['replace_warehouse', 'replace_product', 'replace_serial'],
              },
            ),
          );
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
                completed_delivery_note: {
                  name: stockEntry.stock_voucher_number,
                },
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
          stockEntry.items.find(item => {
            if (item.serial_no.toUpperCase() === NON_SERIAL_ITEM) {
              return undefined;
            }
            return item.serial_no;
          })
        ) {
          return from(
            this.serialNoHistoryService.deleteOne({
              document_no: stockEntry.stock_voucher_number,
              parent_document: stockEntry.warrantyClaimUuid,
            }),
          );
        }
        return of(true);
      }),
    );
  }

  revertStatusHistory(uuid: string) {
    return from(
      this.warrantyService.findOne({
        uuid,
        status_history: {
          $elemMatch: {
            verdict: CURRENT_STATUS_VERDICT.DELIVER_TO_CUSTOMER,
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

  resetCancelledSerialItem(stock_voucher_number: string) {
    let stockEntryObject;
    return from(this.stockEntryService.findOne({ stock_voucher_number })).pipe(
      switchMap((stockEntry: any) => {
        stockEntryObject = stockEntry;
        return from(
          this.warrantyService.findOne({
            uuid: stockEntry.warrantyClaimUuid,
            claim_type: WARRANTY_TYPE.THIRD_PARTY,
          }),
        );
      }),
      switchMap(warranty => {
        if (!warranty) {
          return from(
            this.serialService.updateOne(
              { serial_no: stockEntryObject.items[0]?.serial_no },
              {
                $set: {
                  customer: stockEntryObject.items[0].customer,
                  warehouse: stockEntryObject.items[0].warehouse,
                  'warranty.salesWarrantyDate': stockEntryObject.items[0].warranty.salesWarrantyDate,
                  'warranty.soldOn': stockEntryObject.items[0].warranty.soldOn,
                  sales_invoice_name: stockEntryObject.items[0].sales_invoice_name,
                  delivery_note: stockEntryObject.items[0].delivery_note,
                },
              },
            ),
          );
        }
        return from(
          this.serialService.updateOne(
            { serial_no: stockEntryObject.items[0]?.serial_no },
            {
              $set: {
                'warranty.salesWarrantyDate': warranty.received_on,
                'warranty.soldOn': warranty.received_on,
              },
              $unset: ['delivery_note'],
            },
          ),
        );
      }),
    );
  }
}
