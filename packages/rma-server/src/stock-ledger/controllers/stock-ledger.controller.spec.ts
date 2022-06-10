import { Test, TestingModule } from '@nestjs/testing';
import { StockLedgerController } from './stock-ledger.controller';

describe('StockLedgerController', () => {
  let controller: StockLedgerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockLedgerController],
    }).compile();

    controller = module.get<StockLedgerController>(StockLedgerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
