import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PurchaseInvoiceWebhookDto } from '../../entity/purchase-invoice/purchase-invoice-webhook-dto';
import { PurchaseInvoiceWebhookAggregateService } from '../../aggregates/purchase-invoice-webhook-aggregate/purchase-invoice-webhook-aggregate.service';

@Controller('purchase_invoice')
export class PurchaseInvoiceWebhookController {
  constructor(
    private readonly purchaseInvoiceWebhookAggregate: PurchaseInvoiceWebhookAggregateService,
  ) {}
  @Post('webhook/v1/create')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  // @UseGuards(FrappeWebhookGuard)
  purchaseInvoiceCreated(
    @Body() purchaseInvoicePayload: PurchaseInvoiceWebhookDto,
  ) {
    return this.purchaseInvoiceWebhookAggregate.purchaseInvoiceCreated(
      purchaseInvoicePayload,
    );
  }
}
