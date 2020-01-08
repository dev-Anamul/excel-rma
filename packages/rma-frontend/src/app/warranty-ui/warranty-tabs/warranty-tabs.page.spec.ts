import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WarrantyTabsPage } from './warranty-tabs.page';
import { Location } from '@angular/common';

describe('WarrantyTabsPage', () => {
  let component: WarrantyTabsPage;
  let fixture: ComponentFixture<WarrantyTabsPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [WarrantyTabsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: Location,
          useValue: {},
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WarrantyTabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
