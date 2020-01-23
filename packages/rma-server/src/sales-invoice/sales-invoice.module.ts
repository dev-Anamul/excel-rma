import { Module, HttpModule } from '@nestjs/common';
import { SalesInvoiceAggregatesManager } from './aggregates';
import { SalesInvoiceQueryManager } from './query';
import { CqrsModule } from '@nestjs/cqrs';
import { SalesInvoiceCommandManager } from './command';
import { SalesInvoiceEventManager } from './event';
import { SalesInvoiceController } from './controllers/sales-invoice/sales-invoice.controller';
import { SalesInvoicePoliciesService } from './policies/sales-invoice-policies/sales-invoice-policies.service';
import { SalesInvoiceEntitiesModule } from './entity/entity.module';
import { CustomerModule } from '../customer/customer.module';
import { SerialNoModule } from '../serial-no/serial-no.module';

@Module({
  imports: [
    SalesInvoiceEntitiesModule,
    CqrsModule,
    HttpModule,
    CustomerModule,
    SerialNoModule,
  ],
  controllers: [SalesInvoiceController],
  providers: [
    ...SalesInvoiceAggregatesManager,
    ...SalesInvoiceQueryManager,
    ...SalesInvoiceEventManager,
    ...SalesInvoiceCommandManager,
    SalesInvoicePoliciesService,
  ],
  exports: [SalesInvoiceEntitiesModule],
})
export class SalesInvoiceModule {}
