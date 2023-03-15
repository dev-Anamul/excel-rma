import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SerialQuantityPage } from './serial-quantity.page';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MaterialModule } from '../../material/material.module';
import { SalesService } from '../../sales-ui/services/sales.service';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';

describe('SerialQuantityPage', () => {
  let component: SerialQuantityPage;
  let fixture: ComponentFixture<SerialQuantityPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [SerialQuantityPage],
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
            getStore: () => ({
              getItemAsync: (...args) => of([]),
            }),
          },
        },
        {
          provide: CsvJsonService,
          useValue: {},
        },
        {
          provide: StockEntryService,
          useValue: {
            listSerialQuantity: (...args) => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SerialQuantityPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
