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

  // fetch vouchers
  async getVoucherTypeList() {
    return this.stockLedgerService.distinct();
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
            switchMap((filteredItems: Array<{ _id: string }>) => {
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
            }),
            toArray(),
            switchMap(summary => {
              return of({
                docs: summary,
                length: summary.length,
                offset: query.offset,
              });
            }),
          );
      }),
    );
  }

  async getStockLedgerList(offset, limit, sort, filter_query, req) {
    const filter_Obj: any = {};
    filter_query.forEach(element => {
      if (element[0] === 'item_code') {
        filter_Obj['item.item_code'] = element[2];
      }
      if (element[0] === 'excel_item_group') {
        filter_Obj['item.item_group'] = element[2];
      }
      if (element[0] === 'excel_item_brand') {
        filter_Obj['item.brand'] = element[2];
      }
      if (element[0] === 'warehouse') {
        filter_Obj['_id.warehouse'] = element[2];
      }
      if (element[1] === '==') {
        filter_Obj.stockAvailability = { $lte: element[2] };
      }
      if (element[1] === '!=') {
        filter_Obj.stockAvailability = { $gt: element[2] };
      }
    });
    if (Object.entries(filter_Obj).length !== 0) {
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
      const $sort: any = {
        '_id.item_code': -1,
      };
      where.push({ $sort });
      const $limit: any = limit;
      const $skip: any = offset;
      where.push({ $skip });
      where.push({ $limit });
      return this.stockLedgerService.asyncAggregate(where);
    } else {
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
      const $limit: any = limit;
      const $skip: any = offset;
      const $lookup: any = {
        from: 'item',
        localField: '_id.item_code',
        foreignField: 'item_code',
        as: 'item',
      };
      where.push({ $lookup });
      const $unwind: any = '$item';
      where.push({ $unwind });
      const $sort: any = {
        '_id.item_code': -1,
      };
      where.push({ $sort });
      where.push({ $skip });
      where.push({ $limit });
      return this.stockLedgerService.asyncAggregate(where);
    }
  }

  async getStockLedgerListCount(offset, limit, sort, filter_query, req) {
    const filter_Obj: any = {};
    filter_query.forEach(element => {
      if (element[0] === 'item_code') {
        filter_Obj['item.item_code'] = element[2];
      }
      if (element[0] === 'excel_item_group') {
        filter_Obj['item.item_group'] = element[2];
      }
      if (element[0] === 'excel_item_brand') {
        filter_Obj['item.brand'] = element[2];
      }
      if (element[0] === 'warehouse') {
        filter_Obj['_id.warehouse'] = element[2];
      }
      if (element[1] === '==') {
        filter_Obj.stockAvailability = { $lte: element[2] };
      }
      if (element[1] === '!=') {
        filter_Obj.stockAvailability = { $gt: element[2] };
      }
    });
    if (Object.entries(filter_Obj).length !== 0) {
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
      where.push({ $count: 'count' });
      return this.stockLedgerService.asyncAggregate(where);
    } else {
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
      where.push({ $count: 'count' });

      return this.stockLedgerService.asyncAggregate(where);
    }
  }

  // LEDGER REPORT
  getLedgerReportList(offset, limit, filter_query, req, date) {
    const filter_Obj: any = {};
    filter_query.forEach(element => {
      if (element[0] === 'warehouse') {
        filter_Obj.warehouse = element[2];
      }
      if (element[0] === 'voucher_no') {
        filter_Obj.voucher_no = element[2];
      }
      if (element[0] === 'voucher_type') {
        filter_Obj.voucher_type = element[2];
      }
      if (element[0] === 'item_code') {
        filter_Obj.item_code = element[2];
      }
      if (element[0] === 'excel_item_brand') {
        filter_Obj['item.brand'] = element[2];
      }
      if (element[0] === 'excel_item_group') {
        filter_Obj['item.item_group'] = element[2];
      }
    });
    let startDate;
    let endDate;
    if (date) {
      if (date.start_date != null && date.end_date != null) {
        startDate = new Date(date.start_date);
        endDate = new Date(date.end_date);
        endDate.setDate(endDate.getDate() + 1);
        const dateObj: any = {
          $gte: startDate,
          $lte: endDate,
        };
        filter_Obj.posting_date = dateObj;
      }
    }

    // IF FILTER APPLY
    if (Object.entries(filter_Obj).length !== 0) {
      const where: any = [];

      const $lookup: any = {
        from: 'item',
        localField: 'item_code',
        foreignField: 'item_code',
        as: 'item',
      };
      where.push({ $lookup });
      const $unwind: any = '$item';
      where.push({ $unwind });

      const $match: any = filter_Obj;
      where.push({ $match });
      const $sort: any = {
        posting_date: 1,
      };
      where.push({ $sort });
      const $limit: any = limit;
      const $skip: any = offset;
      where.push({ $skip });
      where.push({ $limit });

      return this.stockLedgerService.asyncAggregate(where);
    }
    // WITHOUT FILTER
    else {
      const where: any = [];
      const $lookup: any = {
        from: 'item',
        localField: 'item_code',
        foreignField: 'item_code',
        as: 'item',
      };
      where.push({ $lookup });
      const $unwind: any = '$item';
      where.push({ $unwind });

      const $limit: any = limit;
      const $skip: any = offset;
      const $sort: any = {
        posting_date: 1,
      };
      where.push({ $sort });
      where.push({ $skip });
      where.push({ $limit });

      return this.stockLedgerService.asyncAggregate(where);
    }
  }
  // LEDGER REPORT COUNT
  getLedgerReportListCount(offset, limit, filter_query, req, date) {
    const filter_Obj: any = {};
    filter_query.forEach(element => {
      if (element[0] === 'warehouse') {
        filter_Obj.warehouse = element[2];
      }
      if (element[0] === 'voucher_no') {
        filter_Obj.voucher_no = element[2];
      }
      if (element[0] === 'voucher_type') {
        filter_Obj.voucher_type = element[2];
      }
      if (element[0] === 'item_code') {
        filter_Obj.item_code = element[2];
      }
      if (element[0] === 'excel_item_brand') {
        filter_Obj['item.brand'] = element[2];
      }
      if (element[0] === 'excel_item_group') {
        filter_Obj['item.item_group'] = element[2];
      }
    });
    let startDate;
    let endDate;
    if (date) {
      if (date.start_date != null && date.end_date != null) {
        startDate = new Date(date.start_date);
        endDate = new Date(date.end_date);
        endDate.setDate(endDate.getDate() + 1);
        const dateObj: any = {
          $gte: startDate,
          $lte: endDate,
        };
        filter_Obj.posting_date = dateObj;
      }
    }

    // IF FILTER APPLY
    if (Object.entries(filter_Obj).length !== 0) {
      const where: any = [];

      const $lookup: any = {
        from: 'item',
        localField: 'item_code',
        foreignField: 'item_code',
        as: 'item',
      };
      where.push({ $lookup });
      const $unwind: any = '$item';
      where.push({ $unwind });

      const $match: any = filter_Obj;
      where.push({ $match });
      const $sort: any = {
        posting_date: 1,
      };
      where.push({ $sort });
      where.push({ $count: 'count' });
      return this.stockLedgerService.asyncAggregate(where);
    }
    // WITHOUT FILTER
    else {
      const where: any = [];
      where.push({ $count: 'count' });
      return this.stockLedgerService.asyncAggregate(where);
    }
  }
}
