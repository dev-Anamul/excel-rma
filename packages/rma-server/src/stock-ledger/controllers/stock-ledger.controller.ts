import { 
    Controller,
    Get,
    UseGuards,
    UsePipes,
    ValidationPipe,
    Query,
    Req
 } from '@nestjs/common';
import {StockLedgerAggregateService} from '../aggregates/stock-ledger-aggregate.service'
import { TokenGuard } from '../../auth/guards/token.guard';


@Controller('stock-ledger')
export class StockLedgerController {
    constructor(
         private readonly aggregate: StockLedgerAggregateService
    ) {}

    @Get('v1/list')
    @UseGuards(TokenGuard)
    @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true }))
   async  getPurchaseInvoiceList(
      @Query() query,
      @Req() req,
    ) {

      const { limit_start, limit_page_length, filters } = query;
      let filter;
      const sort = 'ASC'
      try {
        
        filter = JSON.parse(filters);
      } catch {
        filter;
      }
      return await this.aggregate.getStockLedgerList(
        Number(limit_start) || 0,
        Number(limit_page_length) || 10,
        sort,
        filter,
        req,
      )
      
    }
    @Get('v1/list_count')
    @UseGuards(TokenGuard)
    @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true }))
   async  getPurchaseInvoiceListCount(
      @Query() query,
      @Req() req,
    ) {

      const { limit_start, limit_page_length, filters } = query;
      let filter;
      const sort = 'ASC'
      try {
        
        filter = JSON.parse(filters);
      } catch {
        filter;
      }
      return await this.aggregate.getStockLedgerListCount(
        Number(limit_start) || 0,
        Number(limit_page_length) || 10,
        sort,
        filter,
        req,
      ),
      this.aggregate.getStockLedgerListCount(
        Number(limit_start) || 0,
        Number(limit_page_length) || 10,
        sort,
        filter,
        req,
      )
      
    }

}
