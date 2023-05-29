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
    let filter = {};
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

  @Get('v1/get_voucher_type')
  @UseGuards(TokenGuard)
  async getVoucher() {
    return this.stockLedgerAggregate.getVoucherTypeList();
  }

  @Get('v1/ledger_report')
  @UseGuards(TokenGuard)
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true }))
  async getLedgerReport(
    @Query('offset') offset = 0,
    @Query('limit') limit = 10,
    @Query('sort') sort: any,
    @Query('query') query: any,
  ) {
    let filter = {};
    try {
      filter = JSON.parse(query);
    } catch {
      filter;
    }
    return await this.stockLedgerAggregate.listLedgerReport(
      Number(offset) || 0,
      Number(limit) || 10,
      filter,
      sort,
    );
  }

  @Get('v1/list_stock_ledger')
  @UseGuards(TokenGuard)
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true }))
  async listStockLedger(
    @Query('offset') offset = 0,
    @Query('limit') limit = 10,
    @Query('sort') sort: any,
    @Query('query') query: any,
  ) {
    let filter = {};
    try {
      filter = JSON.parse(query);
    } catch {
      filter;
    }
    return await this.stockLedgerAggregate.listStockLedger(
      Number(offset) || 0,
      Number(limit) || 10,
      filter,
      sort,
    );
  }
}
