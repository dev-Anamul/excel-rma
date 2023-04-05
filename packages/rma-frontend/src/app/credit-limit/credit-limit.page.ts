import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { PopoverController } from '@ionic/angular';
import { CreditLimitDataSource } from './credit-limit-datasource';
import { SalesService } from '../sales-ui/services/sales.service';
import { UpdateCreditLimitComponent } from './update-credit-limit/update-credit-limit.component';
import { DEFAULT_COMPANY } from '../constants/storage';
import { StorageService } from '../api/storage/storage.service';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { ValidateInputSelected } from '../common/pipes/validators';

@Component({
  selector: 'app-credit-limit',
  templateUrl: './credit-limit.page.html',
  styleUrls: ['./credit-limit.page.scss'],
})
export class CreditLimitPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: CreditLimitDataSource;
  displayedColumns = [
    'name',
    'customer_name',
    'credit_limits',
    'extended_credit_limit',
    'expiry_date',
    'set_by',
    'set_on',
  ];
  filteredCustomerList: Observable<any[]>;
  customerProfileForm: FormGroup = new FormGroup({
    customer: new FormControl(),
  });
  validateInput: any = ValidateInputSelected;

  get f() {
    return this.customerProfileForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly storage: StorageService,
    private readonly popoverController: PopoverController,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new CreditLimitDataSource(this.salesService);
    this.dataSource.loadItems(undefined, undefined, 0, 30);
    this.filteredCustomerList = this.f.customer.valueChanges.pipe(
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
      undefined,
      undefined,
      this.paginator.pageIndex || undefined,
      this.paginator.pageSize || undefined,
    );
  }

  navigateBack() {
    this.location.back();
  }

  async updateCreditLimitDialog(row?: any) {
    const defaultCompany = await this.storage.getItem(DEFAULT_COMPANY);
    const creditLimits: { credit_limit: number; company: string }[] =
      row.credit_limits || [];
    let creditLimit = 0;

    for (const limit of creditLimits) {
      if (limit.company === defaultCompany) {
        creditLimit = limit.credit_limit;
      }
    }

    const popover = await this.popoverController.create({
      component: UpdateCreditLimitComponent,
      componentProps: {
        uuid: row.uuid,
        customer: row.name,
        baseCreditLimit: row.baseCreditLimitAmount || 0,
        currentCreditLimit: creditLimit,
        expiryDate: row.tempCreditLimitPeriod,
      },
    });
    popover.onDidDismiss().then(() => {
      this.dataSource.loadItems();
    });
    return await popover.present();
  }

  setFilter(event: any) {
    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      event.option.value,
      this.sort.direction,
      event.pageIndex || 0,
      event.pageSize || 30,
    );
  }

  getUpdate(event: any) {
    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      event.option.value,
      undefined,
      event?.pageIndex || undefined,
      event?.pageSize || undefined,
    );
  }
}
