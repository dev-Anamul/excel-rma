import { Injectable, BadRequestException } from '@nestjs/common';
import {
  SerialNoPoliciesService,
  ValidateSerialsResponse,
} from '../../../serial-no/policies/serial-no-policies/serial-no-policies.service';
import { AssignSerialDto } from '../../../serial-no/entity/serial-no/assign-serial-dto';
import { from, of, throwError, forkJoin } from 'rxjs';
import { switchMap, concatMap } from 'rxjs/operators';
import { MAX_SERIAL_BODY_COUNT } from '../../../constants/app-strings';
import { ValidateSerialsDto } from '../../../serial-no/entity/serial-no/serial-no-dto';
import { StockLedgerService } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.service';
import { INSUFFICIENT_STOCK_IN_WAREHOUSE } from '../../../constants/messages';

@Injectable()
export class DeliveryNotePoliciesService {
  constructor(
    private readonly serialNoPoliciesService: SerialNoPoliciesService,
    private readonly stockLedgerService: StockLedgerService,
  ) {}

  validateDeliveryNote(assignPayload: AssignSerialDto, clientHttpRequest) {
    return forkJoin({
      validateMaxLimit: from(this.validateMaxLimit(assignPayload)),
      validateSerials: from(this.validateSerials(assignPayload)),
    }).pipe(
      switchMap(({ validateMaxLimit, validateSerials }) => {
        if (validateMaxLimit && validateSerials) {
          return of(true);
        } else {
          return throwError(
            new BadRequestException(INSUFFICIENT_STOCK_IN_WAREHOUSE),
          );
        }
      }),
    );
  }

  validateMaxLimit(assignPayload: AssignSerialDto) {
    return from(assignPayload.items).pipe(
      switchMap(item => {
        if (item.has_serial_no && item.qty > MAX_SERIAL_BODY_COUNT) {
          return throwError(
            new BadRequestException(
              `There can only be ${MAX_SERIAL_BODY_COUNT} serials for a single row for a entry, try assigning in separate invoice.`,
            ),
          );
        }
        return of(true);
      }),
    );
  }

  validateSerials(assignPayload: AssignSerialDto) {
    return from(assignPayload.items).pipe(
      concatMap(item => {
        if (!item.has_serial_no) {
          // Check stock for non serialized item
          return this.stockLedgerService
            .asyncAggregate([
              {
                $match: {
                  item_code: item.item_code,
                  warehouse: assignPayload.set_warehouse,
                },
              },
              {
                $group: { _id: '$item_code', total: { $sum: '$actual_qty' } },
              },
            ])
            .pipe(
              switchMap(data => {
                if (data[0].total < item.qty) {
                  return of(false);
                } else {
                  return of(true);
                }
              }),
            );
        }
        const serials = new ValidateSerialsDto();
        serials.serials = item.serial_no;
        serials.item_code = item.item_code;
        serials.warehouse = assignPayload.set_warehouse;
        return this.serialNoPoliciesService
          .validateSerialsForDeliveryNote(serials)
          .pipe(
            switchMap(data => {
              return of({
                notFoundSerials: data[0]
                  ? data[0].notFoundSerials
                  : serials.serials,
              });
            }),
            switchMap((data: ValidateSerialsResponse) => {
              if (data && data.notFoundSerials && data.notFoundSerials.length) {
                return throwError(
                  new BadRequestException(
                    `Found ${
                      data.notFoundSerials.length
                    } Invalid Serials for item: ${
                      item.item_code
                    } at warehouse: ${
                      assignPayload.set_warehouse
                    }, ${data.notFoundSerials.splice(0, 50).join(', ')}...`,
                  ),
                );
              }
              return of(true);
            }),
          );
      }),
    );
  }
}
