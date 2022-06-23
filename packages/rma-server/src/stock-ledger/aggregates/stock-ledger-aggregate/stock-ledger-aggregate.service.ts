import { Injectable } from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { forkJoin, from, of } from 'rxjs';
import { concatMap, switchMap, toArray } from 'rxjs/operators';
import { StockLedgerService } from '../../../stock-ledger/entity/stock-ledger/stock-ledger.service';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';

@Injectable()
export class StockLedgerAggregateService extends AggregateRoot {
  constructor(
    private readonly stockLedgerService: StockLedgerService,
    private readonly settingsService: SettingsService,
  ) {
    super();
  }

  getStockSummaryList(query: {
    limit: number;
    offset: number;
    sort: string;
    filter: any;
  }) {
    let startDate;
    let endDate;
    return this.settingsService.find().pipe(
      switchMap(settings => {
        startDate = new Date(query.filter.start_date);
        startDate.toLocaleString('en-US', { timeZone: settings.timeZone });
        endDate = new Date(query.filter.end_date);
        endDate.toLocaleString('en-US', { timeZone: settings.timeZone });
        return of(settings);
      }),
      switchMap(() => {
        return this.stockLedgerService
          .asyncAggregate([
            {
              $match: {
                posting_date: {
                  $gte: startDate,
                  $lte: endDate,
                },
              },
            },
            {
              $group: { _id: '$item_code' },
            },
            { $limit: query.limit },
            { $skip: query.offset },
          ])
          .pipe(
            switchMap(
              (filteredItems: Array<{ _id: string; item_name: any }>) => {
                return from(filteredItems).pipe(
                  concatMap(filterItem => {
                    return forkJoin({
                      inward: this.stockLedgerService.asyncAggregate([
                        {
                          $match: {
                            item_code: filterItem._id,
                            posting_date: {
                              $gte: startDate,
                              $lte: endDate,
                            },
                            actual_qty: {
                              $gt: 0,
                            },
                          },
                        },
                        {
                          $group: {
                            _id: '$item_name',
                            totalInward: { $sum: '$actual_qty' },
                          },
                        },
                      ]),
                      outward: this.stockLedgerService.asyncAggregate([
                        {
                          $match: {
                            item_code: filterItem._id,
                            posting_date: {
                              $gte: startDate,
                              $lte: endDate,
                            },
                            actual_qty: {
                              $lt: 0,
                            },
                          },
                        },
                        {
                          $group: {
                            _id: '$item_name',
                            totalOutward: {
                              $sum: '$actual_qty',
                            },
                          },
                        },
                      ]),
                    }).pipe(
                      switchMap((res: any) => {
                        return of({
                          item_code: filterItem._id,
                          item_name: res.inward.length
                            ? res.inward.find(x => x)._id
                            : res.outward.length
                            ? res.outward.find(x => x)._id
                            : filterItem._id,
                          total_inward: res.inward.length
                            ? res.inward.find(x => x).totalInward
                            : 0,
                          total_outward: res.outward.length
                            ? res.outward.find(x => x).totalOutward
                            : 0,
                        });
                      }),
                    );
                  }),
                );
              },
            ),
            toArray(),
            switchMap(summary => {
              return of(summary);
            }),
          );
      }),
    );
  }
}
