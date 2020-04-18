import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { MaterialTransferComponent } from './material-transfer.component';
import { SalesService } from '../../sales-ui/services/sales.service';
import { MaterialModule } from '../../material/material.module';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';
import { TimeService } from '../../api/time/time.service';
import { SerialsService } from '../../common/helpers/serials/serials.service';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import { RouterTestingModule } from '@angular/router/testing';

describe('MaterialTransferComponent', () => {
  let component: MaterialTransferComponent;
  let fixture: ComponentFixture<MaterialTransferComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MaterialTransferComponent],
      imports: [
        IonicModule.forRoot(),
        MaterialModule,
        FormsModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        BrowserDynamicTestingModule,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        {
          provide: SalesService,
          useValue: {
            getSalesInvoice: (...args) =>
              of({ items: [], delivered_items_map: {} }),
            getWarehouseList: (...args) => of([{}]),
            getStore: () => ({
              getItem: (...args) => Promise.resolve('ITEM'),
            }),
          },
        },
        {
          provide: TimeService,
          useValue: {},
        },
        {
          provide: StockEntryService,
          useValue: {},
        },
        {
          provide: SerialsService,
          useValue: {},
        },
        {
          provide: CsvJsonService,
          useValue: {},
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
