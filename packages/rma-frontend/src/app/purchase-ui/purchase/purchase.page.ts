import { Component, OnInit, ViewChild } from '@angular/core';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseInvoiceDataSource } from './purchase-invoice-datasource';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { Location } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
} from 'rxjs/operators';
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
    start_date: new FormControl(),
    end_date: new FormControl(),
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
        distinctUntilChanged(),
        debounceTime(1000),
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
    if (this.f.start_date.value && this.f.end_date.value) {
      query.fromDate = new Date(this.f.start_date.value).setHours(0, 0, 0, 0);
      query.toDate = new Date(this.f.end_date.value).setHours(23, 59, 59, 59);
    }

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
      this.sortQuery,
    );
  }

  getTotal() {
    this.dataSource.total.subscribe({
      next: total => {
        this.total = total;
      },
    });
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.supplier.value) query.supplier = this.f.supplier.value;
    if (this.f.status.value) query.status = this.f.status.value;
    if (this.f.invoice_number.value) query.name = this.f.invoice_number.value;
    if (this.f.start_date.value && this.f.end_date.value) {
      query.fromDate = new Date(this.f.start_date.value).setHours(0, 0, 0, 0);
      query.toDate = new Date(this.f.end_date.value).setHours(23, 59, 59, 59);
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
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
      this.sortQuery,
    );
  }

  clearFilters() {
    this.purchaseForm.reset();
    this.status = 'All';
    this.f.status.setValue('All');
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      undefined,
      this.sortQuery,
    );
  }

  navigateBack() {
    this.location.back();
  }
}
