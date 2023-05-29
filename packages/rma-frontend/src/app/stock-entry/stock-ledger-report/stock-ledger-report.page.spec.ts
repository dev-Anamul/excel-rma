import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MaterialModule } from '../../material/material.module';
import { SalesService } from '../../sales-ui/services/sales.service';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import { StockLedgerReportPage } from './stock-ledger-report.page';
import { StockLedgerService } from '../services/stock-ledger/stock-ledger.service';

describe('StockLedgerReportPage', () => {
  let component: StockLedgerReportPage;
  let fixture: ComponentFixture<StockLedgerReportPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StockLedgerReportPage],
      imports: [
        IonicModule.forRoot(),
        MaterialModule,
        FormsModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: SalesService,
          useValue: {
            getItemList: () => of([{}]),
            getLedgerCount: (...args) => of(0),
            getStockLedger: () => of(),
            getStore: () => ({
              getItemAsync: (...args) => of([]),
            }),
            getItemGroupList: (...args) => of([]),
            getItemBrandList: (...args) => of([]),
          },
        },
        {
          provide: StockEntryService,
          useValue: {
            getVoucherTypeList: (...args) => of([]),
          },
        },
        {
          provide: StockLedgerService,
          useValue: {
            listLedgerReport: (...args) => of([]),
          },
        },
        {
          provide: CsvJsonService,
          useValue: {},
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StockLedgerReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
