import { Module } from '@nestjs/common';
import { StockLedgerEntitiesModule } from './entity/entity.module';
import { StockLedgerController } from './controllers/stock-ledger.controller';
import { StockLedgerAggregateService } from './aggregates/stock-ledger-aggregate.service';
import { ItemEntitiesModule } from '../item/entity/item-entity.module';

@Module({
  imports: [StockLedgerEntitiesModule,ItemEntitiesModule],
  controllers: [StockLedgerController],
  providers: [StockLedgerAggregateService],
  exports: [StockLedgerEntitiesModule],
})
export class StockLedgerModule {}
