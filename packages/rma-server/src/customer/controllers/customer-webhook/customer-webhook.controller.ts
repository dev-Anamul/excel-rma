import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { CustomerWebhookInterface } from '../../entity/customer/customer-webhook-interface';
import { CustomerWebhookAggregateService } from '../../aggregates/customer-webhook-aggregate/customer-webhook-aggregate.service';
import { FrappeWebhookGuard } from '../../../auth/guards/frappe-webhook.guard';

@Controller('customer')
export class CustomerWebhookController {
  constructor(
    private readonly customerWebhookAggregate: CustomerWebhookAggregateService,
  ) {}

  @Post('webhook/v1/create')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @UseGuards(FrappeWebhookGuard)
  customerCreated(@Body() customerPayload: CustomerWebhookInterface) {
    return this.customerWebhookAggregate.customerCreated(customerPayload);
  }

  @Post('webhook/v1/update')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @UseGuards(FrappeWebhookGuard)
  customerUpdated(@Body() customerPayload: CustomerWebhookInterface) {
    return this.customerWebhookAggregate.customerUpdated(customerPayload);
  }

  @Post('webhook/v1/delete')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @UseGuards(FrappeWebhookGuard)
  customerDeleted(@Body() customerPayload: CustomerWebhookInterface) {
    return this.customerWebhookAggregate.customerDeleted(customerPayload);
  }
}