import { Injectable, BadRequestException, HttpService } from '@nestjs/common';
import {
  StockEntryDto,
  StockEntryItemDto,
} from '../../entities/stock-entry-dto';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { switchMap, mergeMap, toArray, map } from 'rxjs/operators';
import { forkJoin, from, Observable, of, throwError } from 'rxjs';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import {
  STOCK_ENTRY_STATUS,
  STOCK_ENTRY_TYPE,
  AGENDA_JOB_STATUS,
} from '../../../constants/app-strings';
import { StockEntry } from '../../entities/stock-entry.entity';
import { SerialNoHistoryPoliciesService } from '../../../serial-no/policies/serial-no-history-policies/serial-no-history-policies.service';
import { AgendaJobService } from '../../../sync/entities/agenda-job/agenda-job.service';
import { RELAY_GET_STOCK_BALANCE_ENDPOINT } from '../../../constants/routes';

@Injectable()
export class StockEntryPoliciesService {
  constructor(
    private readonly serialNoService: SerialNoService,
    private readonly settingsService: SettingsService,
    private readonly serialNoHistoryPolicy: SerialNoHistoryPoliciesService,
    private readonly agendaJob: AgendaJobService,
    private readonly http: HttpService,
    private readonly settings: SettingsService,
  ) {}

  validateStockEntry(payload: StockEntryDto, clientHttpRequest) {
    return this.settingsService.find().pipe(
      switchMap(settings => {
        return this.validateStockSerials(
          payload.items,
          payload.stock_entry_type,
          settings,
          clientHttpRequest,
        );
      }),
      switchMap(() => {
        return this.validateItemStock(payload, clientHttpRequest);
      }),
    );
  }

  validateItemStock(payload: StockEntryDto, req) {
    return this.settings.find().pipe(
      switchMap(settings => {
        if (payload?.items?.length === 0) {
          return of(true);
        }
        return from(payload.items).pipe(
          switchMap(item => {
            const body = {
              item_code: item.item_code,
              warehouse: item.s_warehouse,
            };
            const headers = this.settings.getAuthorizationHeaders(req.token);
            return this.http
              .post(
                settings.authServerURL + RELAY_GET_STOCK_BALANCE_ENDPOINT,
                body,
                { headers },
              )
              .pipe(
                map(data => data.data.message),
                switchMap(message => {
                  if (message < item.qty) {
                    return throwError(
                      new BadRequestException(`
                  Only ${message} available in stock for item ${item.item_name}, 
                  at warehouse ${item.s_warehouse}.
                  `),
                    );
                  }
                  return of(true);
                }),
              );
          }),
        );
      }),
      toArray(),
      switchMap(success => of(true)),
    );
  }

  validateStockEntryCancel(stockEntry: StockEntry): Observable<StockEntry> {
    if (stockEntry.status !== STOCK_ENTRY_STATUS.delivered) {
      return throwError(
        new BadRequestException(
          `${stockEntry.status} stock entry cannot be canceled`,
        ),
      );
    }

    const message = `${stockEntry.stock_entry_type} stock entry with status ${stockEntry.status} cannot be canceled.`;

    switch (stockEntry.stock_entry_type) {
      case STOCK_ENTRY_TYPE.MATERIAL_TRANSFER:
        return throwError(new BadRequestException(message));

      case STOCK_ENTRY_TYPE.MATERIAL_ISSUE:
        return this.validateMaterialIssueReset(stockEntry);

      case STOCK_ENTRY_TYPE.MATERIAL_RECEIPT:
        return this.validateMaterialReceiptReset(stockEntry);

      case STOCK_ENTRY_TYPE.RnD_PRODUCTS:
        return this.validateMaterialIssueReset(stockEntry);

      default:
        return throwError(new BadRequestException('Invalid Stock Entry'));
    }
  }

  validateMaterialReceiptReset(stockEntry: StockEntry) {
    return forkJoin({
      validateSerialState: this.validateSerialState(stockEntry),
      validateSerials: this.validateMaterialReceiptSerials(stockEntry),
    }).pipe(
      switchMap(valid => {
        return of(stockEntry);
      }),
    );
  }

  validateMaterialIssueReset(stockEntry: StockEntry) {
    return forkJoin({
      validateSerialState: this.validateSerialState(stockEntry),
      validateSerials: this.validateMaterialIssueSerials(stockEntry),
    }).pipe(
      switchMap(valid => {
        return of(stockEntry);
      }),
    );
  }

  validateMaterialIssueSerials(invoice: StockEntry) {
    const serials = this.getInvoiceSerials(invoice);
    return this.serialNoHistoryPolicy
      .validateLatestEventWithParent(invoice.uuid, serials)
      .pipe(
        switchMap(response => {
          let message = `Found ${response.length} Events, please cancel Following events for serials
        `;
          response.forEach(value =>
            value
              ? (message += `${value._id} : ${value.serials
                  .splice(0, 50)
                  .join(', ')}`)
              : null,
          );
          if (response && response.length) {
            return throwError(message);
          }
          return of(true);
        }),
      );
  }

  validateStockEntryQueue(stockEntry: StockEntry) {
    return from(
      this.agendaJob.count({
        'data.parent': stockEntry.uuid,
        'data.status': {
          $in: [
            AGENDA_JOB_STATUS.exported,
            AGENDA_JOB_STATUS.fail,
            AGENDA_JOB_STATUS.in_queue,
            AGENDA_JOB_STATUS.retrying,
          ],
        },
      }),
    ).pipe(
      switchMap(response => {
        if (response) {
          return throwError(
            new BadRequestException(
              `Found ${response}, jobs in queue for sales invoice: ${stockEntry.uuid}`,
            ),
          );
        }
        return of(true);
      }),
    );
  }

  getInvoiceSerials(invoice: StockEntry) {
    const serials = [];
    invoice.items.forEach(item =>
      item.has_serial_no ? serials.push(...item.serial_no) : null,
    );
    return serials;
  }

  validateMaterialReceiptSerials(invoice: StockEntry) {
    const serials = this.getInvoiceSerials(invoice);
    return this.serialNoHistoryPolicy
      .validateLatestEventWithParent(invoice.uuid, serials)
      .pipe(
        switchMap(response => {
          let message = `Found ${response.length} Events, please cancel Following events for serials
          `;
          response.forEach(value =>
            value
              ? (message += `${value._id} : ${value.serials
                  .splice(0, 50)
                  .join(', ')}`)
              : null,
          );
          if (response && response.length) {
            return throwError(new BadRequestException(message));
          }
          return of(invoice);
        }),
      );
  }

  validateSerialState(invoice: StockEntry) {
    return from(
      this.serialNoService.count({
        purchase_invoice_name: invoice.uuid,
        queue_state: { $gt: {} },
      }),
    ).pipe(
      switchMap(count => {
        if (count) {
          return throwError(
            new BadRequestException(
              `Found ${count} serials to be already in queue, please reset queue to proceed.`,
            ),
          );
        }
        return of(invoice);
      }),
    );
  }

  validateStockSerials(
    items: StockEntryItemDto[],
    stock_entry_type: string,
    settings,
    clientHttpRequest,
  ) {
    return from(items).pipe(
      mergeMap(item => {
        if (!item.has_serial_no) {
          return of(true);
        }
        let query: any = {
          serial_no: { $in: item.serial_no },
          item_code: item.item_code,
          warehouse: item.s_warehouse,
          'queue_state.purchase_receipt': { $exists: false },
          $or: [
            {
              'warranty.soldOn': { $exists: false },
              'queue_state.delivery_note': { $exists: false },
            },
            {
              'warranty.claim_no': { $exists: true },
            },
          ],
        };
        if (stock_entry_type === STOCK_ENTRY_TYPE.MATERIAL_RECEIPT) {
          query = {
            serial_no: { $in: item.serial_no },
            $or: [
              { 'queue_state.purchase_receipt': { $exists: true } },
              { 'queue_state.stock_entry': { $exists: true } },
              { purchase_document_no: { $exists: true } },
            ],
          };
        }

        return from(this.serialNoService.count(query)).pipe(
          mergeMap(count => {
            const message = `Found ${count} Qty for Item : ${item.item_name} at warehouse: ${item.s_warehouse}.`;
            if (
              count === item.serial_no.length &&
              [
                STOCK_ENTRY_TYPE.MATERIAL_TRANSFER,
                STOCK_ENTRY_TYPE.MATERIAL_ISSUE,
                STOCK_ENTRY_TYPE.RnD_PRODUCTS,
              ].includes(stock_entry_type)
            ) {
              return of(true);
            }
            if (
              count === 0 &&
              stock_entry_type === STOCK_ENTRY_TYPE.MATERIAL_RECEIPT
            ) {
              return of(true);
            }
            return throwError(new BadRequestException(message));
          }),
        );
      }),
      toArray(),
      switchMap(isValid => {
        return of(true);
      }),
    );
  }
}
