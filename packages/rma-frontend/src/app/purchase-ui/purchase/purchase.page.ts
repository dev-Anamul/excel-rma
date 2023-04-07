import { Component, OnInit, ViewChild } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseInvoiceDataSource } from './purchase-invoice-datasource';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { Location } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, startWith, switchMap } from 'rxjs/operators';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
} from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { MY_FORMATS } from '../../constants/date-format';
import { ValidateInputSelected } from '../../common/pipes/validators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-purchase',
  templateUrl: './purchase.page.html',
  styleUrls: ['./purchase.page.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class PurchasePage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: PurchaseInvoiceDataSource;
  displayedColumns = [
    'sr_no',
    'purchase_invoice_number',
    'status',
    'delivered_percent',
    'date',
    'supplier',
    'total',
    'created_by',
    'delivered_by',
  ];
  invoiceStatus: string[] = ['Completed', 'Canceled', 'Submitted', 'All'];
  status: string = 'All';
  total: number = 0;
  sortQuery: any = {};
  purchaseForm: FormGroup = new FormGroup({
    invoice_number: new FormControl(),
    supplier: new FormControl(),
    status: new FormControl(),
    fromDateFormControl: new FormControl(),
    toDateFormControl: new FormControl(),
    singleDateFormControl: new FormControl(),
  });
  validateInput: any = ValidateInputSelected;
  filteredSupplierList: Observable<any[]>;

  get f() {
    return this.purchaseForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly purchaseService: PurchaseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new PurchaseInvoiceDataSource(this.purchaseService);
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map((event: any) => {
          if (event.url === '/purchase') {
            this.dataSource.loadItems(undefined, undefined, undefined, {});
          }
          return event;
        }),
      )
      .subscribe({
        next: () => {
          this.getTotal();
        },
        error: () => {},
      });

    this.filteredSupplierList = this.purchaseForm
      .get('supplier')
      .valueChanges.pipe(
        startWith(''),
        switchMap(value => {
          return this.purchaseService.getSupplierList(value);
        }),
      );
  }

  getUpdate(event: any) {
    const query: any = {};
    if (this.f.supplier.value) query.supplier = this.f.supplier.value;
    if (this.f.status.value) query.status = this.f.status.value;
    if (this.f.invoice_number.value) query.name = this.f.invoice_number.value;

    if (this.f.singleDateFormControl.value) {
      query.fromDate = new Date(this.f.singleDateFormControl.value).setHours(
        0,
        0,
        0,
        0,
      );
      query.toDate = new Date(this.f.singleDateFormControl.value).setHours(
        23,
        59,
        59,
        59,
      );
    }
    if (this.f.fromDateFormControl.value && this.f.toDateFormControl.value) {
      query.fromDate = new Date(this.f.fromDateFormControl.value).setHours(
        0,
        0,
        0,
        0,
      );
      query.toDate = new Date(this.f.toDateFormControl.value).setHours(
        23,
        59,
        59,
        59,
      );
    }

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
    );
  }

  getTotal() {
    this.dataSource.total.subscribe({
      next: total => {
        this.total = total;
      },
    });
  }

  dateFilter() {
    this.f.singleDateFormControl.setValue('');
    this.setFilter();
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.supplier.value) query.supplier = this.f.supplier.value;
    if (this.f.status.value) query.status = this.f.status.value;
    if (this.f.invoice_number.value) query.name = this.f.invoice_number.value;
    if (this.f.fromDateFormControl.value && this.f.toDateFormControl.value) {
      query.fromDate = new Date(this.f.fromDateFormControl.value).setHours(
        0,
        0,
        0,
        0,
      );
      query.toDate = new Date(this.f.toDateFormControl.value).setHours(
        23,
        59,
        59,
        59,
      );
    }
    if (this.f.singleDateFormControl.value) {
      query.fromDate = new Date(this.f.singleDateFormControl.value).setHours(
        0,
        0,
        0,
        0,
      );
      query.toDate = new Date(this.f.singleDateFormControl.value).setHours(
        23,
        59,
        59,
        59,
      );
    }
    if (event) {
      for (const key of Object.keys(event)) {
        if (key === 'active' && event.direction !== '') {
          this.sortQuery[event[key]] = event.direction;
        }
      }
    }

    this.sortQuery =
      Object.keys(this.sortQuery).length === 0
        ? { created_on: 'DESC' }
        : this.sortQuery;

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
    );
  }

  singleDateFilter() {
    this.f.fromDateFormControl.setValue('');
    this.f.toDateFormControl.setValue('');
    this.setFilter();
  }

  clearFilters() {
    this.purchaseForm.reset();
    this.status = 'All';
    this.f.status.setValue('All');
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;
    this.dataSource.loadItems(
      this.sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      undefined,
    );
  }

  navigateBack() {
    this.location.back();
  }
}
