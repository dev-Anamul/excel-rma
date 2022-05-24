import { Module } from '@nestjs/common';
import { StockLedgerEntitiesModule } from './entity/entity.module';

@Module({
  imports: [StockLedgerEntitiesModule],
  controllers: [],
  providers: [],
  exports: [StockLedgerEntitiesModule],
})
export class StockLedgerModule {}
