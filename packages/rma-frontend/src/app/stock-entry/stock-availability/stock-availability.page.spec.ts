import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { StockAvailabilityPage } from './stock-availability.page';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MaterialModule } from '../../material/material.module';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import { StockLedgerService } from '../services/stock-ledger/stock-ledger.service';
import { SalesService } from 'src/app/sales-ui/services/sales.service';

describe('StockAvailabilityPage', () => {
  let component: StockAvailabilityPage;
  let fixture: ComponentFixture<StockAvailabilityPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StockAvailabilityPage],
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
          provide: CsvJsonService,
          useValue: {},
        },
        {
          provide: StockLedgerService,
          useValue: {
            listStockLedger: (...args) => of([]),
          },
        },
        {
          provide: SalesService,
          useValue: {
            getItemList: (...args) => of([]),
            getStore: () => ({
              getItemAsync: (...args) => Promise.resolve({}),
            }),
            getItemGroupList: (...args) => of([]),
            getItemBrandList: (...args) => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StockAvailabilityPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
