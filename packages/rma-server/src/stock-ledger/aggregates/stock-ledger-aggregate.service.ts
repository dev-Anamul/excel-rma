import {StockLedgerService} from '../entity/stock-ledger/stock-ledger.service'
import { 
    Injectable,
 } from '@nestjs/common';


@Injectable()
export class StockLedgerAggregateService {
    constructor(
        private readonly stockLedgerService : StockLedgerService,

    ){}

  async  getStockLedgerList(offset, limit, sort, filter_query, req) {
        var filter_Obj = {}
        filter_query.forEach((element) => {
          if(element[0] =="item_code"){
              filter_Obj["item.item_code"] = element[2]
          }
          if(element[0]=="excel_item_group"){
            filter_Obj["item.item_group"] = element[2]
          }
          if(element[0] =="excel_item_brand"){
            filter_Obj["item.brand"] = element[2]
          }
          if(element[0]== "warehouse"){
            filter_Obj["_id.warehouse"] = element[2]
          }
          if(element[1] == "=="){
              filter_Obj["stockAvailability"] = {$eq: element[2]}
          }
          if(element[1] == "!="){
            filter_Obj["stockAvailability"] = {$gt: element[2]}
        }
        });
        if(Object.entries(filter_Obj).length != 0 ){
            var obj : any= {
                "_id":{
                    warehouse : "$warehouse",
                    item_code : "$item_code"
                },
                "stockAvailability":{
                    $sum: "$actual_qty"
                }
            }
            const $group : any = obj;
            const where : any = []
            where.push({$group})
            const $lookup : any ={
                from: "item",
                localField: "_id.item_code",
                foreignField: "item_code",
                as: "item"
            }
            where.push({$lookup})
            const $unwind : any ="$item"
            where.push({$unwind})
            const $match : any = filter_Obj
            where.push({$match})
            const $limit : any = limit
            const $skip : any = offset
            where.push({$skip})
            where.push({$limit})
            return this.stockLedgerService.asyncAggregate(where)
            
        }  else {
            var obj : any= {
                "_id":{
                    warehouse : "$warehouse",
                    item_code : "$item_code"
                },
                "stockAvailability":{
                    $sum: "$actual_qty"
                }
            }
            const $group : any = obj;
            const where : any = []
            where.push({$group})
            const $limit : any = limit
            const $skip : any = offset
            const $lookup : any ={
                from: "item",
                localField: "_id.item_code",
                foreignField: "item_code",
                as: "item"
            }
            where.push({$lookup})
            const $unwind : any ="$item"
            where.push({$unwind})
            where.push({$skip})
            where.push({$limit})
           return this.stockLedgerService.asyncAggregate(where)
        }
    }

    async  getStockLedgerListCount(offset, limit, sort, filter_query, req) {
          var filter_Obj = {}
          filter_query.forEach((element) => {
            if(element[0] =="item_code"){
                filter_Obj["item.item_code"] = element[2]
            }
            if(element[0]=="excel_item_group"){
              filter_Obj["item.item_group"] = element[2]
            }
            if(element[0] =="excel_item_brand"){
              filter_Obj["item.brand"] = element[2]
            }
            if(element[0]== "warehouse"){
              filter_Obj["_id.warehouse"] = element[2]
            }
            if(element[1] == "=="){
                filter_Obj["stockAvailability"] = {$eq: element[2]}
            }
            if(element[1] == "!="){
                filter_Obj["stockAvailability"] = {$gt: element[2]}
            }
          });
          if(Object.entries(filter_Obj).length != 0 ){
              var obj : any= {
                  "_id":{
                      warehouse : "$warehouse",
                      item_code : "$item_code"
                  },
                  "stockAvailability":{
                      $sum: "$actual_qty"
                  }
              }
              const $group : any = obj;
              const where : any = []
              where.push({$group})
              const $lookup : any ={
                  from: "item",
                  localField: "_id.item_code",
                  foreignField: "item_code",
                  as: "item"
              }
              where.push({$lookup})
              const $unwind : any ="$item"
              where.push({$unwind})
              const $match : any = filter_Obj
              where.push({$match})
            where.push({$count: "count"})
              return this.stockLedgerService.asyncAggregate(where)
              
          }  else {
              var obj : any= {
                  "_id":{
                      warehouse : "$warehouse",
                      item_code : "$item_code"
                  },
                  "stockAvailability":{
                      $sum: "$actual_qty"
                  }
              }
              const $group : any = obj;
              const where : any = []
              where.push({$group})
              where.push({$count: "count"})
              
             return this.stockLedgerService.asyncAggregate(where)
          }
      }
}
