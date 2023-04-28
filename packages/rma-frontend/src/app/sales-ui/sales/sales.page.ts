import { Component, OnInit, ViewChild } from '@angular/core';
import { SalesService } from '../services/sales.service';
import { SalesInvoice } from '../../common/interfaces/sales.interface';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { SalesInvoiceDataSource } from './sales-invoice-datasource';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import {
  map,
  filter,
  startWith,
  switchMap,
  distinctUntilChanged,
  debounceTime,
} from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
} from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { MY_FORMATS } from '../../constants/date-format';
import {
  INVOICE_DELIVERY_STATUS,
  INVOICE_STATUS,
} from '../../constants/app-string';
import { PERMISSION_STATE } from '../../constants/permission-roles';
import { Observable, of } from 'rxjs';
import { ValidateInputSelected } from '../../common/pipes/validators';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.page.html',
  styleUrls: ['./sales.page.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class SalesPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: SalesInvoiceDataSource;
  displayedColumns = [
    'sr_no',
    'name',
    'status',
    'posting_date',
    'posting_time',
    'customer_name',
    'total',
    'delivered_percent',
    'delivery_status',
    'due_amount',
    'remarks',
    'territory',
    'created_by',
    'delivered_by',
  ];
  invoiceStatus: string[] = Object.values(INVOICE_STATUS);
  statusColor = {
    Draft: 'blue',
    'To Deliver': '#4d2500',
    Completed: 'green',
    Rejected: 'red',
    Submitted: '#4d2500',
    Canceled: 'red',
  };
  campaignStatus: string[] = ['Yes', 'No', 'All'];
  delivery_statuses: string[] = Object.values(INVOICE_DELIVERY_STATUS);
  status: string = 'All';
  total: number = 0;
  dueTotal: number = 0;
  bufferValue: number = 70;
  disableRefresh: boolean = false;
  campaign: string = 'All';
  sortQuery: any = {};
  salesInvoiceList: Array<SalesInvoice>;

  salesForm: FormGroup = new FormGroup({
    customer_name: new FormControl(),
    fromDateFormControl: new FormControl(),
    toDateFormControl: new FormControl(),
    singleDateFormControl: new FormControl(),
    salesPerson: new FormControl(),
    invoice_number: new FormControl(),
    branch: new FormControl(),
    campaign: new FormControl(),
    status: new FormControl(),
    delivery_status: new FormControl(),
  });

  filteredSalesPersonList: Observable<any[]>;
  filteredCustomerList: Observable<any[]>;
  filteredTerritoryList: Observable<any[]>;

  validateInput: any = ValidateInputSelected;
  permissionState = PERMISSION_STATE;

  get f() {
    return this.salesForm.controls;
  }

  constructor(
    private readonly salesService: SalesService,
    private readonly location: Location,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.setAutoComplete();
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new SalesInvoiceDataSource(this.salesService);
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map((event: any) => {
          if (event.url === '/sales')
            this.dataSource.loadItems(undefined, undefined, undefined, {
              status: this.status,
            });
          return event;
        }),
      )
      .subscribe({
        next: () => {
          this.getTotal();
        },
        error: () => {},
      });
    this.dataSource.disableRefresh.subscribe({
      next: res => {
        this.disableRefresh = res;
      },
    });
  }

  setAutoComplete() {
    this.filteredSalesPersonList = this.f.salesPerson.valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getSalesPersonList(value);
      }),
      switchMap((data: any[]) => {
        const salesPersons = [];
        data.forEach(person =>
          person.name !== 'Sales Team' ? salesPersons.push(person.name) : null,
        );
        return of(salesPersons);
      }),
    );

    this.filteredCustomerList = this.salesForm
      .get('customer_name')
      .valueChanges.pipe(
        startWith(''),
        distinctUntilChanged(),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService
            .getCustomerList(value)
            .pipe(map(res => res.docs));
        }),
      );

    this.filteredTerritoryList = this.salesForm.get('branch').valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getStore().getItemAsync('territory', value);
      }),
    );
  }

  getTotal() {
    this.dataSource.total.subscribe({
      next: total => {
        this.total = total;
      },
    });
    this.dataSource.dueAmountTotal.subscribe({
      next: dueTotal => {
        this.dueTotal = dueTotal;
      },
    });
  }

  syncOutstandingAmount() {
    this.dataSource.syncOutstandingAmount().subscribe({
      next: () => {},
    });
  }

  getUpdate(event: any) {
    const query: any = {};
    if (this.f.customer_name.value)
      query.customer_name = this.f.customer_name.value;
    if (this.f.status.value) query.status = this.f.status.value;
    if (this.f.invoice_number.value) query.name = this.f.invoice_number.value;
    if (this.f.salesPerson.value) query.sales_team = this.f.salesPerson.value;
    if (this.f.branch.value) query.territory = this.f.branch.value;
    if (this.campaign) {
      if (this.campaign === 'Yes') {
        query.isCampaign = true;
      } else if (this.campaign === 'No') {
        query.isCampaign = false;
      }
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

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
    );
  }

  dateFilter() {
    this.f.singleDateFormControl.setValue('');
    this.setFilter();
  }

  singleDateFilter() {
    this.f.fromDateFormControl.setValue('');
    this.f.toDateFormControl.setValue('');
    this.setFilter();
  }

  getStringTime(stringTime: string) {
    const newDate = new Date();
    const [hours, minutes, seconds] = stringTime.split(':');
    newDate.setHours(+hours);
    newDate.setMinutes(Number(minutes));
    newDate.setSeconds(Number(seconds));
    return newDate;
  }

  clearFilters() {
    this.salesForm.reset();
    this.status = 'All';
    this.campaign = 'All';

    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;
    this.dataSource.loadItems(
      undefined,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      {
        status: this.status,
      },
    );
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.customer_name.value)
      query.customer_name = this.f.customer_name.value;
    if (this.status) query.status = this.status;
    if (this.f.salesPerson.value) query.sales_team = this.f.salesPerson.value;
    if (this.f.invoice_number.value) query.name = this.f.invoice_number.value;
    if (this.f.branch) query.territory = this.f.branch.value;
    if (this.f.delivery_status.value) {
      query.delivery_status = this.f.delivery_status.value;
    }
    if (this.campaign) {
      if (this.campaign === 'Yes') {
        query.isCampaign = true;
      } else if (this.campaign === 'No') {
        query.isCampaign = false;
      }
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
    this.sortQuery = {};
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

    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
    );
  }

  navigateBack() {
    this.location.back();
  }

  statusChange(status: string) {
    if (status === 'All') {
      this.dataSource.loadItems();
    } else {
      this.status = status;
      this.setFilter();
    }
  }

  getDate(date: string) {
    return new Date(date);
  }

  statusOfCampaignChange(campaign: string) {
    if (campaign === 'All') {
      this.dataSource.loadItems();
    } else {
      this.campaign = campaign;
      this.setFilter();
    }
  }

  getStatusColor(status: string) {
    return { color: this.statusColor[status] };
  }
}
