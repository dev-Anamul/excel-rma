import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { StockEntryComponent } from './stock-entry.component';
import { RouterTestingModule } from '@angular/router/testing';
import {
  NoopAnimationsModule,
  BrowserAnimationsModule,
} from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material/material.module';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { StockEntryService } from '../../../stock-entry/services/stock-entry/stock-entry.service';
import { STORAGE_TOKEN } from '../../../api/storage/storage.service';
import { of } from 'rxjs';

describe('StockEntryComponent', () => {
  let component: StockEntryComponent;
  let fixture: ComponentFixture<StockEntryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StockEntryComponent],
      imports: [
        IonicModule.forRoot(),
        BrowserAnimationsModule,
        HttpClientTestingModule,
        MaterialModule,
        FormsModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        {
          provide: StockEntryService,
          useValue: {
            getStockEntryList: (...args) => of([{}]),
          },
        },
        {
          provide: STORAGE_TOKEN,
          useValue: {},
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StockEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
