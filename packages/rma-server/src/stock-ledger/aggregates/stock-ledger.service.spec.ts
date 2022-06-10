import { Test, TestingModule } from '@nestjs/testing';
import { StockLedgerAggregateService } from './stock-ledger-aggregate.service';

describe('StockLedgerAggregateService', () => {
  let service: StockLedgerAggregateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockLedgerAggregateService],
    }).compile();

    service = module.get<StockLedgerAggregateService>(StockLedgerAggregateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
