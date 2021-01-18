import { Injectable, HttpService, BadRequestException } from '@nestjs/common';
import { switchMap, mergeMap, catchError, retry, map } from 'rxjs/operators';
import {
  VALIDATE_AUTH_STRING,
  STOCK_ENTRY,
  STOCK_ENTRY_TYPE,
  STOCK_ENTRY_NAMING_SERIES,
  CREATE_STOCK_ENTRY_JOB,
  ACCEPT_STOCK_ENTRY_JOB,
  REJECT_STOCK_ENTRY_JOB,
  STOCK_ENTRY_STATUS,
} from '../../../constants/app-strings';
import {
  POST_DELIVERY_NOTE_ENDPOINT,
  STOCK_ENTRY_API_ENDPOINT,
} from '../../../constants/routes';
import { DirectService } from '../../../direct/aggregates/direct/direct.service';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { of, throwError, from, forkJoin } from 'rxjs';
import { DateTime } from 'luxon';
import { StockEntry } from '../../entities/stock-entry.entity';
import { StockEntryService } from '../../entities/stock-entry.service';
import { AgendaJobService } from '../../../sync/entities/agenda-job/agenda-job.service';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import {
  EventType,
  SerialNoHistoryInterface,
} from '../../../serial-no/entity/serial-no-history/serial-no-history.entity';
import { TokenCache } from '../../../auth/entities/token-cache/token-cache.entity';
import { StockEntryItem } from '../../entities/stock-entry.entity';
import { ServerSettings } from '../../../system-settings/entities/server-settings/server-settings.entity';

@Injectable()
export class StockEntrySyncService {
  constructor(
    private readonly tokenService: DirectService,
    private readonly http: HttpService,
    private readonly settingsService: SettingsService,
    private readonly serialNoService: SerialNoService,
    private readonly stockEntryService: StockEntryService,
    private readonly jobService: AgendaJobService,
    private readonly serialNoHistoryService: SerialNoHistoryService,
  ) {}

  execute(job) {
    return this.createStockEntry(job.attrs.data);
  }

  resetState(job) {
    this.updateStockEntryState(job.data.payload.uuid, {
      isSynced: false,
      inQueue: false,
    });
    return from(
      this.stockEntryService.findOne({ uuid: job.data.payload.uuid }),
    ).pipe(
      switchMap(stockEntry => {
        switch (stockEntry.stock_entry_type) {
          case STOCK_ENTRY_TYPE.MATERIAL_ISSUE:
            return this.resetMaterialIssue(stockEntry);

          case STOCK_ENTRY_TYPE.MATERIAL_RECEIPT:
            return this.resetMaterialReceipt(stockEntry);

          case STOCK_ENTRY_TYPE.MATERIAL_TRANSFER:
            return this.resetMaterialTransfer(stockEntry, job.data.type);

          case STOCK_ENTRY_TYPE.RnD_PRODUCTS:
            return this.resetMaterialIssue(stockEntry);

          default:
            return throwError(
              new BadRequestException('Invalid StockEntry type'),
            );
        }
      }),
    );
  }

  resetMaterialReceipt(stockEntry: StockEntry) {
    const serialHash = this.getStockEntrySerials(stockEntry);
    const serials = [];
    Object.values(serialHash).forEach(hash => serials.push(...hash.serials));
    return forkJoin({
      updateStockEntry: from(
        this.stockEntryService.updateOne(
          { uuid: stockEntry.uuid },
          { $set: { status: STOCK_ENTRY_STATUS.draft } },
        ),
      ),
      updateSerials: from(
        this.serialNoService.deleteMany({ serial_no: { $in: serials } }),
      ),
    });
  }

  resetMaterialIssue(stockEntry: StockEntry, status?) {
    const serialHash = this.getStockEntrySerials(stockEntry);
    const serials = [];
    Object.values(serialHash).forEach(hash => serials.push(...hash.serials));
    return forkJoin({
      updateStockEntry: from(
        this.stockEntryService.updateOne(
          { uuid: stockEntry.uuid },
          { $set: { status: status || STOCK_ENTRY_STATUS.draft } },
        ),
      ),
      updateSerials: from(
        this.serialNoService.updateMany(
          { serial_no: { $in: serials } },
          {
            $unset: {
              queue_state: {
                stock_entry: null,
              },
            },
          },
        ),
      ),
    });
  }

  resetMaterialTransfer(stockEntry: StockEntry, type: string) {
    switch (type) {
      case ACCEPT_STOCK_ENTRY_JOB:
        return this.resetMaterialIssue(
          stockEntry,
          STOCK_ENTRY_STATUS.in_transit,
        );

      case REJECT_STOCK_ENTRY_JOB:
        return this.resetMaterialIssue(
          stockEntry,
          STOCK_ENTRY_STATUS.in_transit,
        );

      case CREATE_STOCK_ENTRY_JOB:
        return this.resetMaterialIssue(stockEntry);

      default:
        return throwError(
          new BadRequestException(`Reset for ${type}, not available.`),
        );
    }
  }

  getStockEntrySerials(stockEntry: StockEntry) {
    const serialHash: { [key: string]: { serials: string[] } } = {};
    stockEntry.items.forEach(item => {
      if (serialHash[item.item_code]) {
        serialHash[item.item_code].serials.push(...item.serial_no);
      } else {
        serialHash[item.item_code] = { serials: item.serial_no };
      }
    });
    return serialHash;
  }

  createStockEntry(job: {
    payload: StockEntry;
    token: any;
    settings: any;
    parent: string;
    type: string;
  }) {
    const serialHash: { [key: string]: string[] } = {};
    const payload: StockEntry = job.payload;
    return this.settingsService.find().pipe(
      switchMap(settings => {
        job.settings = settings;
        payload.items.filter((item: any) => {
          if (job.type === CREATE_STOCK_ENTRY_JOB) {
            payload.naming_series = STOCK_ENTRY_NAMING_SERIES[job.type];
            if (
              job.payload.stock_entry_type ===
              STOCK_ENTRY_TYPE.MATERIAL_TRANSFER
            ) {
              item.t_warehouse = item.transferWarehouse;
            } else {
              payload.naming_series =
                STOCK_ENTRY_NAMING_SERIES[payload.stock_entry_type];
            }
          } else {
            payload.naming_series = STOCK_ENTRY_NAMING_SERIES[job.type];
          }
          if (job.type === ACCEPT_STOCK_ENTRY_JOB) {
            item.s_warehouse = item.transferWarehouse;
          }
          if (job.type === REJECT_STOCK_ENTRY_JOB) {
            item.t_warehouse = item.s_warehouse;
            item.s_warehouse = item.transferWarehouse;
          }

          serialHash[item.item_code] =
            this.getSplitSerials(item.serial_no) ||
            this.getSplitSerials(item.excel_serials);
          if (
            item.has_serial_no &&
            item.serial_no &&
            typeof item.serial_no === 'object'
          ) {
            item.serial_no = item.serial_no.join('\n');
          }
          item.excel_serials = item.serial_no;
          delete item.serial_no;
          return item;
        });
        const frappePayload = this.parseFrappePayload(payload);
        const endpoint =
          frappePayload.stock_entry_type === STOCK_ENTRY_TYPE.RnD_PRODUCTS
            ? POST_DELIVERY_NOTE_ENDPOINT
            : STOCK_ENTRY_API_ENDPOINT;
        return this.http.post(
          settings.authServerURL + endpoint,
          frappePayload,
          {
            headers: this.settingsService.getAuthorizationHeaders(job.token),
          },
        );
      }),
      catchError(err => {
        payload.items.filter((item: any) => {
          if (item.has_serial_no) {
            item.serial_no = serialHash[item.item_code];
          }
          return item;
        });
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
        // new approach, we wont reset state let the user retry it from agenda UI.
        return throwError(err);
      }),
      retry(3),
      map((data: any) => data.data.data),
      switchMap(response => {
        payload.items.filter((item: any) => {
          if (item.has_serial_no) {
            item.serial_no = serialHash[item.item_code];
          }
        });
        this.updateSerials(
          payload,
          job.token,
          response.name,
          job.type,
          job.settings,
          job.parent,
        );
        this.stockEntryService
          .updateOne({ uuid: job.parent }, { $push: { names: response.name } })
          .then(success => {})
          .catch(err => {});
        return of({});
      }),
      catchError(err => {
        payload.items.filter((item: any) => {
          if (item.has_serial_no) {
            delete item.excel_serials;
            item.serial_no = serialHash[item.item_code];
          }
          return item;
        });
        return throwError(err);
      }),
    );
  }

  parseFrappePayload(payload: StockEntry) {
    delete payload.names;
    switch (payload.stock_entry_type) {
      case STOCK_ENTRY_TYPE.RnD_PRODUCTS:
        break;

      default:
        delete payload.customer;
        break;
    }
    return payload;
  }

  updateSerials(
    payload: StockEntry,
    token: TokenCache,
    doc_name: string,
    type: string,
    settings,
    parent,
  ) {
    this.updateStockEntryState(payload.uuid, {
      isSynced: true,
      inQueue: false,
    });
    from(payload.items)
      .pipe(
        switchMap(item => {
          if (!item.has_serial_no) {
            return of(true);
          }
          const serials = this.getSplitSerials(item.serial_no);
          const serialHistory: SerialNoHistoryInterface = {};
          serialHistory.created_by = token.fullName;
          serialHistory.created_on = new DateTime(settings.timeZone).toJSDate();
          serialHistory.document_no = doc_name;
          serialHistory.document_type = STOCK_ENTRY;
          serialHistory.eventDate = new DateTime(settings.timeZone);
          serialHistory.eventType = this.getEventType(type, payload);
          serialHistory.parent_document = parent;
          serialHistory.transaction_from = item.s_warehouse;
          serialHistory.transaction_to =
            payload.stock_entry_type === STOCK_ENTRY_TYPE.RnD_PRODUCTS
              ? payload.customer
              : item.t_warehouse;
          return forkJoin({
            serials: this.updateMongoSerials(
              serials,
              this.getSerialUpdateKey(item, payload, doc_name, settings),
            ),
            serial_history: this.serialNoHistoryService.addSerialHistory(
              serials,
              serialHistory,
            ),
          });
        }),
      )
      .subscribe({
        next: success => {},
        error: err => {},
      });
  }

  getSerialUpdateKey(
    item: StockEntryItem,
    payload: StockEntry,
    doc_name: string,
    settings: ServerSettings,
  ) {
    const update = { warehouse: item.t_warehouse };
    if (payload.stock_entry_type === STOCK_ENTRY_TYPE.MATERIAL_TRANSFER) {
      return update;
    }
    return payload.stock_entry_type === STOCK_ENTRY_TYPE.MATERIAL_RECEIPT
      ? {
          ...update,
          purchase_document_no: doc_name,
          purchase_document_type: payload.stock_entry_type,
          'warranty.purchaseWarrantyDate': item.warranty_date,
          'warranty.purchasedOn': new Date(payload.posting_date),
          purchase_invoice_name: payload.uuid,
          item_name: item.item_name,
        }
      : {
          ...update,
          'warranty.salesWarrantyDate': item.warranty_date,
          'warranty.soldOn': DateTime.fromJSDate(new Date(payload.posting_date))
            .setZone(settings.timeZone)
            .toJSDate(),
          sales_document_type: payload.stock_entry_type,
          sales_document_no: doc_name,
          sales_invoice_name: payload.uuid,
        };
  }

  getEventType(type: string, payload: StockEntry) {
    if (type === ACCEPT_STOCK_ENTRY_JOB) {
      return EventType.SerialTransferAccepted;
    }
    if (type === REJECT_STOCK_ENTRY_JOB) {
      return EventType.SerialTransferRejected;
    }
    switch (payload.stock_entry_type) {
      case STOCK_ENTRY_TYPE.MATERIAL_TRANSFER:
        return EventType.SerialTransferCreated;

      case STOCK_ENTRY_TYPE.MATERIAL_ISSUE:
        return EventType.MaterialIssue;

      case STOCK_ENTRY_TYPE.RnD_PRODUCTS:
        return EventType.RnD_PRODUCTS;

      default:
        return EventType.MaterialReceipt;
    }
  }

  updateMongoSerials(serials, update) {
    return from(
      this.serialNoService.updateMany(
        { serial_no: { $in: serials } },
        {
          $set: update,
          $unset: {
            'queue_state.stock_entry': null,
          },
        },
      ),
    );
  }

  getSplitSerials(serials) {
    if (typeof serials === 'string') {
      return serials.split('\n');
    }
    return serials;
  }

  updateStockEntryState(
    uuid: string,
    update: { isSynced: boolean; inQueue: boolean },
  ) {
    this.stockEntryService
      .updateOne({ uuid }, { $set: update })
      .then(success => {})
      .catch(error => {});
  }
}
