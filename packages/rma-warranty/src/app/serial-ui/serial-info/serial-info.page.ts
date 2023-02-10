import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormGroup, FormControl } from '@angular/forms';
import { forkJoin, from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { SERIAL_FETCH_ERROR } from '../../constants/messages';
import { CLOSE } from '../../constants/app-string';
import { SerialSearchService } from '../serial-search/serial-search.service';
import { AUTH_SERVER_URL } from '../../constants/storage';
import { SerialHistoryDataSource } from './serial-info-datasource';

@Component({
  selector: 'app-serial-info',
  templateUrl: './serial-info.page.html',
  styleUrls: ['./serial-info.page.scss'],
})
export class SerialInfoPage implements OnInit {
  serialNo: string;
  viewPRUrl: string;
  viewDNUrl: string;
  viewCustomerUrl: string;
  viewSupplierUrl: string;
  displayedColumns: string[] = [
    'eventType',
    'transaction_from',
    'transaction_to',
    'document_type',
    'document_no',
    'created_by',
    'parent_document',
    'created_on',
  ];
  serialHistoryDataSource: SerialHistoryDataSource;
  serialInfoForm = new FormGroup({
    serial_no: new FormControl(),
    item_code: new FormControl(),
    item_name: new FormControl(),
    warehouse: new FormControl(),
    purchase_document_no: new FormControl(),
    delivery_note: new FormControl(),
    customer: new FormControl(),
    customer_code: new FormControl(),
    supplier: new FormControl(),
  });

  constructor(
    private readonly location: Location,
    private readonly activatedRoute: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly serialSearchService: SerialSearchService,
  ) {}

  ngOnInit() {
    this.serialHistoryDataSource = new SerialHistoryDataSource(
      this.serialSearchService,
    );
    this.serialNo = this.activatedRoute.snapshot.params.serial;
    if (this.activatedRoute.snapshot.paramMap.keys.length > 1) {
      this.loadSerialFromParamMap();
    } else {
      this.fetchSerialData(this.serialNo);
    }
  }

  get f() {
    return this.serialInfoForm.controls;
  }

  fetchSerialData(serial: string) {
    this.serialNo = serial;
    this.serialHistoryDataSource = new SerialHistoryDataSource(
      this.serialSearchService,
    );
    this.serialSearchService.getSerialData(serial).subscribe({
      next: res => {
        this.f.customer_code.setValue(res.customer);
        this.f.serial_no.setValue(res.serial_no);
        this.f.item_code.setValue(res.item_code);
        this.f.item_name.setValue(res.item_name);
        this.f.warehouse.setValue(res.warehouse);
        this.f.purchase_document_no.setValue(res.purchase_document_no);
        this.f.delivery_note.setValue(res.delivery_note);
        this.f.customer.setValue(res.customer_name);
        this.f.supplier.setValue(res.supplier);
        this.setViewUrls();
      },
      error: () => {
        this.ngOnInit();
        this.snackBar.open(serial + ' ' + SERIAL_FETCH_ERROR, CLOSE);
      },
    });
  }

  setViewUrls() {
    forkJoin({
      infoAuthUrl: this.serialSearchService
        .getApiInfo()
        .pipe(map(data => data.authServerUrl)),
      storeAuthUrl: from(
        this.serialSearchService.getStore().getItem(AUTH_SERVER_URL),
      ),
    })
      .pipe(
        switchMap(({ infoAuthUrl, storeAuthUrl }) => {
          return of(storeAuthUrl ? storeAuthUrl : infoAuthUrl);
        }),
      )
      .subscribe({
        next: authServerUrl => {
          this.viewPRUrl = this.f.purchase_document_no.value
            ? `${authServerUrl}/desk#Form/Purchase%20Receipt/${this.f.purchase_document_no.value}`
            : null;
          this.viewDNUrl = this.f.delivery_note.value
            ? `${authServerUrl}/desk#Form/Delivery%20Note/${this.f.delivery_note.value}`
            : null;
          this.viewCustomerUrl = this.f.customer_code.value
            ? `${authServerUrl}/desk#Form/Customer/${this.f.customer_code.value}`
            : null;
          this.viewSupplierUrl = this.f.supplier.value
            ? `${authServerUrl}/desk#Form/Supplier/${this.f.supplier.value}`
            : null;
        },
        error: () => {},
      });
  }

  loadSerialFromParamMap() {
    const paramMap = this.activatedRoute.snapshot.paramMap;
    this.f.customer_code.setValue(paramMap.get('customer'));
    this.f.serial_no.setValue(paramMap.get('serial_no'));
    this.f.item_code.setValue(paramMap.get('item_code'));
    this.f.item_name.setValue(paramMap.get('item_name'));
    this.f.warehouse.setValue(paramMap.get('warehouse'));
    this.f.purchase_document_no.setValue(paramMap.get('purchase_document_no'));
    this.f.delivery_note.setValue(paramMap.get('delivery_note'));
    this.f.customer.setValue(paramMap.get('customer_name'));
    this.f.supplier.setValue(paramMap.get('supplier'));
    this.setViewUrls();
    this.location.replaceState(`/serial-info/${paramMap.get('serial_no')}`);
  }

  navigateBack() {
    this.location.back();
  }

  viewCustomer() {
    if (this.viewCustomerUrl) {
      window.open(this.viewCustomerUrl, '_blank');
    }
  }

  viewSupplier() {
    if (this.viewSupplierUrl) {
      window.open(this.viewSupplierUrl, '_blank');
    }
  }

  viewPurchaseReceipt() {
    if (this.viewPRUrl) {
      window.open(this.viewPRUrl, '_blank');
    }
  }

  getSerialHistory() {
    this.serialHistoryDataSource.loadItems(this.serialNo);
  }
}
