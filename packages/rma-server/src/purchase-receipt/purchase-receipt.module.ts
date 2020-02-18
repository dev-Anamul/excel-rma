import { Module } from '@nestjs/common';
import { PurchaseInvoiceAggregatesManager } from './aggregates';
import { PurchaseReceiptController } from './controllers/purchase-receipt/purchase-receipt.controller';
import { PurchaseInvoiceEntitiesModule } from '../purchase-invoice/entity/entity.module';
import { SerialNoEntitiesModule } from '../serial-no/entity/entity.module';
import { PurchaseReceiptPoliciesService } from './purchase-receipt-policies/purchase-receipt-policies.service';
import { ErrorLogModule } from '../error-log/error-logs-invoice.module';

@Module({
  imports: [
    PurchaseInvoiceEntitiesModule,
    SerialNoEntitiesModule,
    ErrorLogModule,
  ],
  controllers: [PurchaseReceiptController],
  providers: [
    ...PurchaseInvoiceAggregatesManager,
    PurchaseReceiptPoliciesService,
  ],
  exports: [],
})
export class PurchaseReceiptModule {}
