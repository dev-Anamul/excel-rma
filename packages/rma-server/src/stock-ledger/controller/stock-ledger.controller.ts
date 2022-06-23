import {
  Controller,
  UsePipes,
  ValidationPipe,
  Req,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchaseInvoiceListQueryDto } from '../../constants/listing-dto/purchase-invoice-list-query';
import { TokenGuard } from '../../auth/guards/token.guard';
import { StockLedgerAggregateService } from '../aggregates/stock-ledger-aggregate/stock-ledger-aggregate.service';

@Controller('stock_ledger')
export class StockLedgerController {
  constructor(private stockLedgerAggregate: StockLedgerAggregateService) {}

  @Get('v1/summary')
  @UseGuards(TokenGuard)
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true }))
  getStockSummaryList(@Query() query: PurchaseInvoiceListQueryDto, @Req() req) {
    const { offset, limit, sort, filter_query } = query;
    let filter;
    try {
      filter = JSON.parse(filter_query);
    } catch {
      filter;
    }
    return this.stockLedgerAggregate.getStockSummaryList({
      offset: Number(offset) || 0,
      limit: Number(limit) || 10,
      sort,
      filter,
    });
  }
}
