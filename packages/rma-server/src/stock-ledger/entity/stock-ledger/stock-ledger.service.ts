import { InjectRepository } from '@nestjs/typeorm';
import { StockLedger } from './stock-ledger.entity';
import { Injectable } from '@nestjs/common';
import { MongoRepository } from 'typeorm';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class StockLedgerService {
  constructor(
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepository: MongoRepository<StockLedger>,
  ) {}

  async find(query?) {
    return await this.stockLedgerRepository.find(query);
  }

  async listLedgerReport(
    $skip: number,
    $limit: number,
    filter_query: any,
    sort: any,
  ) {
    let $sort: any;
    let dateQuery: any = {};
    try {
      $sort = JSON.parse(sort);
    } catch (error) {
      $sort = { posting_date: 'desc' };
    }
    $sort = Object.keys($sort).length === 0 ? { posting_date: 'desc' } : $sort;
    for (const key of Object.keys($sort)) {
      $sort[key] = $sort[key].toUpperCase();
      if ($sort[key] === 'ASC') {
        $sort[key] = 1;
      }
      if ($sort[key] === 'DESC') {
        $sort[key] = -1;
      }
      if (!$sort[key]) {
        delete $sort[key];
      }
    }

    if (filter_query?.fromDate && filter_query?.toDate) {
      dateQuery = {
        posting_date: {
          $gte: new Date(filter_query.fromDate),
          $lte: new Date(filter_query.toDate),
        },
      };
    }

    const $and: any[] = [
      filter_query ? this.getFilterQuery(filter_query) : {},
      dateQuery,
    ];

    const $match: { $and: any } = { $and };

    const $lookup: any = {
      from: 'item',
      localField: 'item_code',
      foreignField: 'item_code',
      as: 'item',
    };

    const $unwind: any = '$item';

    const results = await this.asyncAggregate([
      { $lookup },
      { $unwind },
      { $match },
      { $skip },
      { $limit },
      { $sort },
    ]).toPromise();

    const length: any = await this.asyncAggregate([
      { $lookup },
      { $unwind },
      { $match },
      { $count: 'total' },
    ]).toPromise();

    return {
      docs: results || [],
      length,
      offset: $skip,
    };
  }

  async listStockLedger(
    $skip: number,
    $limit: number,
    filter_query: any,
    sort: any,
  ) {
    let $sort: any;
    try {
      $sort = JSON.parse(sort);
    } catch (error) {
      $sort = { item_code: 'desc' };
    }
    $sort = Object.keys($sort).length === 0 ? { posting_date: 'desc' } : $sort;
    for (const key of Object.keys($sort)) {
      $sort[key] = $sort[key].toUpperCase();
      if ($sort[key] === 'ASC') {
        $sort[key] = 1;
      }
      if ($sort[key] === 'DESC') {
        $sort[key] = -1;
      }
      if (!$sort[key]) {
        delete $sort[key];
      }
    }

    const $group: any = {
      _id: {
        warehouse: '$warehouse',
        item_code: '$item_code',
      },
      stock_availability: {
        $sum: '$actual_qty',
      },
    };

    const $project: any = {
      _id: 0,
      item_code: '$_id.item_code',
      warehouse: '$_id.warehouse',
      stock_availability: 1,
    };

    if (filter_query.zero_stock) {
      filter_query.stock_availability = { $lte: 0 };
    } else {
      filter_query.stock_availability = { $gt: 0 };
    }

    const $match: any = filter_query ? this.getFilterQuery(filter_query) : {};

    const $lookup: any = {
      from: 'item',
      localField: 'item_code',
      foreignField: 'item_code',
      as: 'item',
    };

    const $unwind: any = '$item';

    const results = await this.asyncAggregate([
      { $group },
      { $project },
      { $lookup },
      { $unwind },
      { $match },
      { $skip },
      { $limit },
      { $sort },
    ]).toPromise();

    const length: any = await this.asyncAggregate([
      { $group },
      { $project },
      { $lookup },
      { $unwind },
      { $match },
      { $count: 'total' },
    ]).toPromise();

    return {
      docs: results || [],
      length,
      offset: $skip,
    };
  }

  async distinct(query: string, options: any) {
    return await this.stockLedgerRepository.distinct(query, options);
  }

  async create(stockLedger: StockLedger) {
    return await this.stockLedgerRepository.insertOne(stockLedger);
  }

  async findOne(param, options?) {
    return await this.stockLedgerRepository.findOne(param, options);
  }

  async deleteOne(query, options?) {
    return await this.stockLedgerRepository.deleteOne(query, options);
  }

  asyncAggregate(query) {
    return of(this.stockLedgerRepository.aggregate(query)).pipe(
      switchMap((aggregateData: any) => {
        return aggregateData.toArray();
      }),
    );
  }

  async updateOne(query, options?) {
    return await this.stockLedgerRepository.updateOne(query, options);
  }

  async insertMany(query, options?) {
    return await this.stockLedgerRepository.insertMany(query, options);
  }

  getFilterQuery(query: any) {
    const keys = Object.keys(query);
    keys.forEach(key => {
      if (typeof query[key] !== 'undefined') {
        if (key === 'item_brand') {
          query['item.brand'] = { $regex: query[key], $options: 'i' };
          delete query[key];
        } else if (key === 'item_group') {
          query['item.item_group'] = { $regex: query[key], $options: 'i' };
          delete query[key];
        } else if (key === 'zero_stock') {
          delete query[key];
        } else if (key === 'fromDate' || key === 'toDate') {
          delete query[key];
        } else if (key === 'stock_availability') {
          query[key];
        } else {
          query[key] = { $regex: query[key], $options: 'i' };
        }
      } else {
        delete query[key];
      }
    });
    return query;
  }
}
