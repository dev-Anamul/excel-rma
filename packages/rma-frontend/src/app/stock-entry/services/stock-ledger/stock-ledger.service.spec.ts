import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { STORAGE_TOKEN } from '../../../api/storage/storage.service';
import { of } from 'rxjs';
import { StockLedgerService } from './stock-ledger.service';

describe('StockLedgerService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: STORAGE_TOKEN,
          useValue: {
            getItemAsync: (...args) => of({}),
          },
        },
      ],
    }),
  );

  it('should be created', () => {
    const service: StockLedgerService = TestBed.get(StockLedgerService);
    expect(service).toBeTruthy();
  });
});
