import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { CustomerDataSource } from './customer-datasource';
import { SalesService } from '../sales-ui/services/sales.service';
import { MatPaginator } from '@angular/material/paginator';
import { forkJoin, from, throwError, of, Observable } from 'rxjs';
import { ItemPriceService } from '../sales-ui/services/item-price.service';
import { TimeService } from '../api/time/time.service';
import { map, switchMap, retry, startWith } from 'rxjs/operators';
import {
  ACCESS_TOKEN,
  AUTHORIZATION,
  AUTH_SERVER_URL,
  BEARER_TOKEN_PREFIX,
  DEFAULT_COMPANY,
} from '../constants/storage';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CLOSE } from '../constants/app-string';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';
import { ValidateInputSelected } from '../common/pipes/validators';
import { DateTime } from 'luxon';

@Component({
  selector: 'app-customer-profile',
  templateUrl: './customer-profile.page.html',
  styleUrls: ['./customer-profile.page.scss'],
})
export class CustomerProfilePage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;

  dataSource: CustomerDataSource;
  defaultCompany: string;
  displayedColumns = [
    'sr_no',
    'customer',
    'territory',
    'credit_limit',
    'remaining_balance',
    'remaining_credit',
  ];
  countFilter: any = {};
  customerProfileForm: FormGroup = new FormGroup({
    customer: new FormControl(),
  });
  filteredCustomerList: Observable<any[]>;
  validateInput: any = ValidateInputSelected;

  get f() {
    return this.customerProfileForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly itemService: ItemPriceService,
    private readonly time: TimeService,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.setDefaultCompany();
    this.dataSource = new CustomerDataSource(this.salesService);
    this.dataSource.loadItems(0, 30, undefined, this.countFilter);
    this.filteredCustomerList = this.customerProfileForm
      .get('customer')
      .valueChanges.pipe(
        startWith(''),
        switchMap(value => {
          return this.salesService
            .getCustomerList(value)
            .pipe(map(res => res.docs));
        }),
      );
  }

  clearFilters() {
    this.customerProfileForm.reset();
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      undefined,
      this.countFilter,
    );
  }

  getUpdate(event: any) {
    const filters = [];
    this.countFilter = {};

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    if (this.f.customer.value) {
      filters.push(['customer_name', 'like', `%${this.f.customer.value}%`]);
      this.countFilter.customer_name = ['like', `%${this.f.customer.value}%`];
    }

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      filters,
      this.countFilter,
    );
  }

  setFilter() {
    const filters = [];
    this.countFilter = {};

    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    if (this.f.customer.value) {
      filters.push(['customer_name', 'like', `%${this.f.customer.value}%`]);
      this.countFilter.customer_name = ['like', `%${this.f.customer.value}%`];
    }

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      filters,
      this.countFilter,
    );
  }

  loadPrice(row: any, index: number) {
    const data = this.dataSource.getData();
    this.dataSource.loadingSubject.next(true);
    if (data && data.length) {
      data[index] = { ...row };
      of({})
        .pipe(
          switchMap(() => {
            return forkJoin({
              time: from(this.time.getDateTime(new Date())),
              token: from(this.salesService.getStore().getItem(ACCESS_TOKEN)),
              debtorAccount: this.salesService
                .getApiInfo()
                .pipe(map(res => res.debtorAccount)),
              customer: this.salesService.relayCustomer(data[index].name),
            });
          }),
          switchMap(({ token, time, debtorAccount, customer }) => {
            if (!debtorAccount) {
              return throwError({
                message: 'Please select Debtor Account in settings',
              });
            }

            if (
              customer &&
              customer.credit_limits &&
              customer.credit_limits.length
            ) {
              customer.credit_limits.forEach(limit => {
                if (limit.company === this.defaultCompany) {
                  data[index].credit_limit = limit.credit_limit;
                }
              });
            } else {
              data[index].credit_limit = '0.00';
            }
            const headers = {
              [AUTHORIZATION]: BEARER_TOKEN_PREFIX + token,
            };
            return this.itemService.getRemainingBalance(
              debtorAccount,
              time,
              'Customer',
              data[index].name,
              this.defaultCompany,
              headers,
            );
          }),
          retry(3),
        )
        .subscribe({
          next: balance => {
            this.dataSource.loadingSubject.next(false);
            data[index].remaining_balance = balance || '0.00';
          },
          error: err => {
            this.dataSource.loadingSubject.next(false);
            this.snackBar.open(
              'Error Occurred in fetching customer balance',
              CLOSE,
              { duration: 3500 },
            );
          },
        });
    } else {
      this.dataSource.loadingSubject.next(false);
    }
    this.dataSource.update(data);
  }

  getRemainingCredit(row) {
    if (row && row.credit_limit && row.remaining_balance) {
      return row.credit_limit - row.remaining_balance;
    }
    return;
  }

  openVoucher(row: any) {
    this.salesService
      .getStore()
      .getItem(AUTH_SERVER_URL)
      .then(auth_url => {
        window.open(
          `${auth_url}/desk#Form/Excel%20Script%20Runner?customer=${
            row.name
          }&fromDate=${DateTime.local().plus({ months: 1 }).toISODate()}
           &toDate=${DateTime.local().toISODate()}`,
        );
      });
  }

  setDefaultCompany() {
    this.salesService
      .getStore()
      .getItems([DEFAULT_COMPANY])
      .then(items => {
        if (items[DEFAULT_COMPANY]) {
          this.defaultCompany = items[DEFAULT_COMPANY];
        } else {
          this.salesService.getApiInfo().subscribe({
            next: res => {
              this.defaultCompany = res.defaultCompany;
            },
            error: () => {
              this.snackBar.open('Error fetching default company', CLOSE, {
                duration: 3500,
              });
            },
          });
        }
      });
  }

  navigateBack() {
    this.location.back();
  }
}
