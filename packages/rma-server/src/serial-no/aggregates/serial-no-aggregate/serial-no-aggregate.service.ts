import {
  Injectable,
  NotFoundException,
  HttpService,
  NotImplementedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { SerialNoService } from '../../entity/serial-no/serial-no.service';
import {
  SerialNoDto,
  ValidateSerialsDto,
  ValidateReturnSerialsDto,
} from '../../entity/serial-no/serial-no-dto';
import { SerialNo } from '../../entity/serial-no/serial-no.entity';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { switchMap, retry, finalize, map } from 'rxjs/operators';
import { throwError, of, from, forkJoin } from 'rxjs';
import {
  AUTHORIZATION,
  CONTENT_TYPE,
  APPLICATION_JSON_CONTENT_TYPE,
  ACCEPT,
  NON_SERIAL_ITEM,
} from '../../../constants/app-strings';
import { BEARER_HEADER_VALUE_PREFIX } from '../../../constants/app-strings';
import {
  FRAPPE_API_SERIAL_NO_ENDPOINT,
  INVOICE_LIST,
} from '../../../constants/routes';
import { SerialNoPoliciesService } from '../../policies/serial-no-policies/serial-no-policies.service';
import {
  SUPPLIER_PROJECT_QUERY,
  CUSTOMER_PROJECT_QUERY,
  ITEM_PROJECT_QUERY,
} from '../../../constants/query';
import { ClientTokenManagerService } from '../../../auth/aggregates/client-token-manager/client-token-manager.service';
import { AssignSerialDto } from '../../entity/serial-no/assign-serial-dto';
import { AssignSerialNoPoliciesService } from '../../policies/assign-serial-no-policies/assign-serial-no-policies.service';
import { DeliveryNoteAggregateService } from '../../../delivery-note/aggregates/delivery-note-aggregate/delivery-note-aggregate.service';
import { ErrorLogService } from '../../../error-log/error-log-service/error-log.service';
import { INVALID_FILE } from '../../../constants/app-strings';
import { SERIAL_NO_NOT_FOUND } from '../../../constants/messages';
import { SerialNoHistoryService } from '../../../serial-no/entity/serial-no-history/serial-no-history.service';
import {
  lockDocumentTransaction,
  unlockDocumentTransaction,
} from '../../../constants/transaction-helper';
import { SalesInvoiceService } from '../../../sales-invoice/entity/sales-invoice/sales-invoice.service';

@Injectable()
export class SerialNoAggregateService extends AggregateRoot {
  constructor(
    private readonly serialNoService: SerialNoService,
    private readonly http: HttpService,
    private readonly settingsService: SettingsService,
    private readonly serialNoPolicyService: SerialNoPoliciesService,
    private readonly serialNoHistoryService: SerialNoHistoryService,
    private readonly assignSerialNoPolicyService: AssignSerialNoPoliciesService,
    private readonly deliveryNoteAggregateService: DeliveryNoteAggregateService,
    private readonly errorLogService: ErrorLogService,
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly clientToken: ClientTokenManagerService,
  ) {
    super();
  }

  validateNewSerialNo(serialNoPayload: SerialNoDto, clientHttpRequest) {
    return this.serialNoPolicyService.validateSerial(serialNoPayload).pipe(
      switchMap(() => {
        return this.serialNoPolicyService.validateItem(serialNoPayload).pipe(
          switchMap(() => {
            const serialNo = new SerialNo();
            Object.assign(serialNo, serialNoPayload);
            serialNo.uuid = uuidv4();
            serialNo.isSynced = false;
            this.syncNewSerialNo(serialNo, clientHttpRequest);
            return of(serialNo);
          }),
        );
      }),
    );
  }

  async retrieveSerialNoHistory(serial_no: string) {
    return await this.serialNoHistoryService.find({ serial_no });
  }

  async retrieveSerialNo(serial_no: string) {
    return this.serialNoService
      .asyncAggregate([
        { $match: { serial_no } },
        {
          $lookup: {
            from: 'item',
            localField: 'item_code',
            foreignField: 'item_code',
            as: 'item',
          },
        },
        {
          $lookup: {
            from: 'supplier',
            localField: 'supplier',
            foreignField: 'name',
            as: 'supplier',
          },
        },
        {
          $lookup: {
            from: 'customer',
            localField: 'customer',
            foreignField: 'name',
            as: 'customer',
          },
        },
        {
          $unwind: this.unwindQuery('$item'),
        },
        {
          $unwind: this.unwindQuery('$supplier'),
        },
        {
          $unwind: this.unwindQuery('$customer'),
        },
        {
          $project: {
            uuid: 1,
            name: 1,
            isSynced: 1,
            serial_no: 1,
            item_code: 1,
            supplier: SUPPLIER_PROJECT_QUERY,
            customer: CUSTOMER_PROJECT_QUERY,
            item: ITEM_PROJECT_QUERY,
          },
        },
      ])
      .pipe(
        switchMap((serial: any[]) => {
          if (!serial || !serial.length) {
            return throwError(new NotFoundException());
          }
          return of(serial);
        }),
      );
  }

  async getSerialNoList(offset, limit, sort, filterQuery) {
    return this.serialNoService.list(offset, limit, sort, filterQuery);
  }

  syncNewSerialNo(serialNo: SerialNo, clientHttpRequest) {
    return this.settingsService
      .find()
      .pipe(
        switchMap(settings => {
          if (!settings.authServerURL) {
            return throwError(new NotImplementedException());
          }
          const body = {
            serial_no: serialNo.serial_no,
            item_code: serialNo.item_code,
            warranty_expiry_date: serialNo.warranty_expiry_date,
            company: serialNo.company,
          };

          return this.http.post(
            settings.authServerURL + FRAPPE_API_SERIAL_NO_ENDPOINT,
            body,
            {
              headers: {
                [AUTHORIZATION]:
                  BEARER_HEADER_VALUE_PREFIX +
                  clientHttpRequest.token.accessToken,
                [CONTENT_TYPE]: APPLICATION_JSON_CONTENT_TYPE,
                [ACCEPT]: APPLICATION_JSON_CONTENT_TYPE,
              },
            },
          );
        }),
        retry(3),
      )
      .subscribe({
        next: () => {
          return this.serialNoService
            .updateOne(
              { uuid: serialNo.uuid },
              {
                $set: {
                  isSynced: true,
                },
              },
            )
            .then(() => {})
            .catch(() => {});
        },
        error: err => {
          this.errorLogService.createErrorLog(
            err,
            'Serial No',
            'serialNo',
            clientHttpRequest,
          );
        },
      });
  }

  unwindQuery(key) {
    return {
      path: key,
      preserveNullAndEmptyArrays: true,
    };
  }

  // Can be improved
  assignSerial(assignPayload: AssignSerialDto, clientHttpRequest) {
    return lockDocumentTransaction(this.salesInvoiceService, {
      name: assignPayload.sales_invoice_name,
    }).pipe(
      switchMap(obj => {
        return of(obj).pipe(
          switchMap(() => {
            return this.assignSerialNoPolicyService.validateSerial(
              assignPayload,
            );
          }),
          switchMap(() => {
            return this.assignSerialNoPolicyService.validateStock(
              assignPayload,
            );
          }),
          switchMap(() => {
            return this.deliveryNoteAggregateService.createDeliveryNote(
              assignPayload,
              clientHttpRequest,
            );
          }),
          switchMap(() => {
            return forkJoin({
              erp_invoice: this.retrieveSalesDoc(
                assignPayload.sales_invoice_name,
              ),
              mongo_invoice: this.salesInvoiceService.findOne({
                name: assignPayload.sales_invoice_name,
              }),
            }).pipe(
              switchMap(({ erp_invoice, mongo_invoice }) => {
                if (Object.keys(mongo_invoice.bundle_items_map).length !== 0) {
                  if (erp_invoice.bundle_items.length) {
                    // IF BUNDLE ITEMS EXISTS
                    if (
                      !erp_invoice.bundle_items.includes(
                        assignPayload.items[0].item_code,
                      )
                    ) {
                      erp_invoice.bundle_items.forEach(item => {
                        erp_invoice.bundle_items.push({
                          item_code: item.item_code,
                          qty: item.qty,
                          item_name: item.item_name,
                          serial_no: item.serial_no.join(', '),
                        });
                      });
                    } else {
                      erp_invoice.bundle_items.forEach(bundle_item => {
                        assignPayload.items.forEach(item => {
                          if (item.item_code === bundle_item.item_code) {
                            bundle_item.serial_no =
                              bundle_item.serial_no +
                              ', ' +
                              item.serial_no.join(', ');
                          }
                        });
                      });
                    }
                  } else {
                    // IF BUNDLE ITEMS DO NOT EXIST
                    assignPayload.items.forEach(payload_item => {
                      if (!erp_invoice.items.includes(payload_item.item_code)) {
                        erp_invoice.bundle_items.push({
                          item_code: payload_item.item_code,
                          qty: payload_item.qty,
                          item_name: payload_item.item_name,
                          serial_no: payload_item.serial_no.join(', '),
                        });
                      } else {
                        erp_invoice.items.forEach(erp_item => {
                          if (payload_item.item_code === erp_item.item_code) {
                            if (
                              payload_item.has_serial_no === 0 &&
                              !erp_item.excel_serials
                            ) {
                              erp_item.excel_serials = payload_item.serial_no.join(
                                '',
                              );
                            } else {
                              erp_item.excel_serials = erp_item.excel_serials
                                ? erp_item.excel_serials +
                                  ', ' +
                                  payload_item.serial_no.join(', ')
                                : payload_item.serial_no.join(', ');
                            }
                          }
                        });
                      }
                    });
                  }
                } else {
                  assignPayload.items.forEach(payload_item => {
                    erp_invoice.items.forEach(erp_item => {
                      if (payload_item.item_code === erp_item.item_code) {
                        if (payload_item.has_serial_no === 0) {
                          erp_item.excel_serials = NON_SERIAL_ITEM;
                        } else {
                          erp_item.excel_serials = erp_item.excel_serials
                            ? erp_item.excel_serials +
                              ', ' +
                              payload_item.serial_no.join(', ')
                            : payload_item.serial_no.join(', ');
                        }
                      }
                    });
                  });
                }
                return this.updateErpInvoice(
                  assignPayload.sales_invoice_name,
                  erp_invoice,
                );
              }),
            );
          }),
          // note: Finalize is a bit tricky it will get triggered on success+failure for
          // the same level pipe as well as its parent.
          // eg. here it will trigger on both validateSerial, createDeliveryNote fail+success and also for of(obj);
          finalize(() =>
            unlockDocumentTransaction(this.salesInvoiceService, {
              name: assignPayload.sales_invoice_name,
            }),
          ),
        );
      }),
    );
  }

  updateErpInvoice(name: string, payload: any) {
    return forkJoin({
      headers: this.clientToken.getServiceAccountApiHeaders(),
      settings: this.settingsService.find(),
    }).pipe(
      switchMap(({ headers, settings }) => {
        const url = settings.authServerURL + INVOICE_LIST + '/' + name;
        return this.http.put(url, payload, { headers });
      }),
    );
  }

  validateReturnSerials(payload: ValidateReturnSerialsDto) {
    return this.serialNoPolicyService.validateReturnSerials(payload);
  }

  validateBulkReturnSerialFile(file) {
    return from(this.getJsonData(file)).pipe(
      switchMap((data: ValidateReturnSerialsDto) => {
        if (!data) {
          return throwError(new BadRequestException(INVALID_FILE));
        }
        return this.validateReturnSerials(data);
      }),
    );
  }

  validateSerials(payload: ValidateSerialsDto) {
    return this.serialNoPolicyService.validateSerials(payload);
  }

  validateBulkSerialFile(file) {
    return from(this.getJsonData(file)).pipe(
      switchMap((data: ValidateSerialsDto) => {
        if (!data) {
          return throwError(new BadRequestException(INVALID_FILE));
        }
        return this.validateSerials(data);
      }),
    );
  }

  getJsonData(file: any) {
    return of(JSON.parse(file.buffer));
  }

  getPurchaseInvoiceDeliveredSerials(
    purchase_invoice_name,
    search,
    skip = 0,
    take = 10,
    clientHttpRequest,
  ) {
    return this.serialNoService.listPurchasedSerial(
      purchase_invoice_name,
      skip,
      take,
      search,
    );
  }

  getSalesInvoiceDeliveryNoteSerials(
    find,
    search,
    offset,
    limit,
    clientHttpRequest,
  ) {
    return this.serialNoService.listDeliveredSerial(
      find,
      search,
      offset,
      limit,
    );
  }

  async getSalesInvoiceReturnSerials(
    sales_invoice_name: string,
    offset: number,
    limit: number,
  ) {
    try {
      const salesInvoice = await this.salesInvoiceService.findOne({
        name: sales_invoice_name,
      });
      const serialNumbers = [];
      salesInvoice.returned_items.forEach(item => {
        serialNumbers.push(...item.serial_no.split('\n'));
      });

      return await this.serialNoService.listReturnInvoicesSerials(
        serialNumbers,
        offset,
        limit,
      );
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  retrieveDirectSerialNo(serial_no: string) {
    return from(this.serialNoService.findOne({ serial_no })).pipe(
      switchMap(serial => {
        if (!serial) {
          return throwError(new NotFoundException(SERIAL_NO_NOT_FOUND));
        }
        return of(serial);
      }),
    );
  }

  retrieveSalesDoc(name: string) {
    return forkJoin({
      headers: this.clientToken.getServiceAccountApiHeaders(),
      settings: this.settingsService.find(),
    }).pipe(
      switchMap(({ headers, settings }) => {
        const url = settings.authServerURL + INVOICE_LIST + '/' + name;
        return this.http
          .get(url, {
            headers,
          })
          .pipe(map(res => res.data.data));
      }),
    );
  }

  async listSerialQuantity(
    offset: number,
    limit: number,
    sort: any,
    query: any,
  ) {
    return await this.serialNoService.listSerialQuantity(
      offset || 0,
      limit || 10,
      sort,
      query,
    );
  }
}
