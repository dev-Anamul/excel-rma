import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { SalesReturnListDataSource } from './sales-return-list.datasource';
import { SalesReturnService } from '../view-sales-invoice/sales-return/sales-return.service';
import { FormControl, FormGroup } from '@angular/forms';
import { SalesService } from '../services/sales.service';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs/internal/Observable';
import {
  switchMap,
  startWith,
  map,
  distinctUntilChanged,
  debounceTime,
} from 'rxjs/operators';
import { ValidateInputSelected } from '../../common/pipes/validators';

@Component({
  selector: 'app-sales-return',
  templateUrl: './sales-return.page.html',
  styleUrls: ['./sales-return.page.scss'],
})
export class SalesReturnPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  statusList = ['Canceled', 'Returned'];
  total = 0;
  dataSource: SalesReturnListDataSource;
  customerList: any;
  displayedColumns = [
    'sr_no',
    'name',
    'posting_date',
    'title',
    'total',
    'status',
    'remarks',
    'owner',
    'modified_by',
  ];
  filters: any = [['is_return', '=', '1']];
  countFilter: any = { is_return: ['=', '1'] };
  salesReturnForm: FormGroup = new FormGroup({
    fromDateFormControl: new FormControl(),
    toDateFormControl: new FormControl(),
    customer: new FormControl(),
    name: new FormControl(),
    status: new FormControl(),
  });
  filteredCustomerList: Observable<any[]>;
  validateInput: any = ValidateInputSelected;

  get f() {
    return this.salesReturnForm.controls;
  }

  constructor(
    private readonly salesReturnService: SalesReturnService,
    private readonly salesService: SalesService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new SalesReturnListDataSource(
      this.salesReturnService,
      this.salesService,
    );
    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      this.filters,
      this.countFilter,
    );
    this.dataSource.totalSubject.subscribe({
      next: total => {
        this.total = total;
      },
    });
    this.filteredCustomerList = this.salesReturnForm
      .get('customer')
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
  }

  getUpdate(event) {
    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      event.pageIndex,
      event.pageSize,
      this.filters,
      this.countFilter,
    );
  }

  setFilter() {
    this.filters = [];
    this.countFilter = {};
    this.filters.push(['is_return', '=', '1']);
    this.countFilter.is_return = ['=', '1'];
    if (this.f.customer.value) {
      this.filters.push(['customer_name', 'like', `${this.f.customer.value}`]);
      this.countFilter.customer_name = ['like', `%${this.f.customer.value}%`];
    }
    if (this.f.name.value) {
      this.filters.push(['name', 'like', `%${this.f.name.value}%`]);
      this.countFilter.name = ['like', `%${this.f.name.value}%`];
    }

    if (this.f.status.value) {
      this.filters.push(['docstatus', '=', this.getStatus()]);
      this.countFilter.docstatus = ['=', this.getStatus()];
    }

    if (this.f.fromDateFormControl.value && this.f.toDateFormControl.value) {
      const fromDate = this.getParsedDate(this.f.fromDateFormControl.value);
      const toDate = this.getParsedDate(this.f.toDateFormControl.value);
      this.filters.push(['creation', 'Between', [fromDate, toDate]]);
      this.countFilter.creation = ['Between', `${fromDate} ${toDate}`];
    }
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      this.filters,
      this.countFilter,
    );
  }

  getStatus() {
    return this.f.status.value === 'Canceled' ? 2 : 1;
  }

  dateFilter() {
    if (this.f.fromDateFormControl.value && this.f.toDateFormControl.value)
      this.setFilter();
  }

  getParsedDate(value) {
    const date = new Date(value);
    return [
      date.getFullYear(),
      date.getMonth() + 1,
      // +1 as index of months start's from 0
      date.getDate(),
    ].join('-');
  }

  clearFilters() {
    this.salesReturnForm.reset();
    this.setFilter();
  }
}
