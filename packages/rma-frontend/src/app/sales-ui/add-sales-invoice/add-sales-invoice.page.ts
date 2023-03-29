import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import {
  FormControl,
  Validators,
  FormGroup,
  FormArray,
  AbstractControl,
} from '@angular/forms';
import { Observable, throwError, of, from, forkJoin } from 'rxjs';
import {
  startWith,
  switchMap,
  filter,
  map,
  mergeMap,
  toArray,
} from 'rxjs/operators';
import { Location } from '@angular/common';
import { SalesInvoice, Item } from '../../common/interfaces/sales.interface';
import { ItemsDataSource } from './items-datasource';
import { SalesService } from '../services/sales.service';
import { SalesInvoiceDetails } from '../view-sales-invoice/details/details.component';
import {
  DEFAULT_COMPANY,
  ACCESS_TOKEN,
  AUTHORIZATION,
  BEARER_TOKEN_PREFIX,
  BACKDATE_PERMISSION,
  BACKDATE_PERMISSION_FOR_DAYS,
  UPDATE_SALES_INVOICE_STOCK,
} from '../../constants/storage';
import {
  DRAFT,
  CLOSE,
  UPDATE_ERROR,
  TERRITORY,
  WAREHOUSES,
} from '../../constants/app-string';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ItemPriceService } from '../services/item-price.service';
import { INSUFFICIENT_STOCK_BALANCE } from '../../constants/messages';
import { TimeService } from '../../api/time/time.service';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
} from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { MY_FORMATS } from '../../constants/date-format';
import { ValidateInputSelected } from '../../common/pipes/validators';
import { StorageService } from '../../api/storage/storage.service';

@Component({
  selector: 'app-add-sales-invoice',
  templateUrl: './add-sales-invoice.page.html',
  styleUrls: ['./add-sales-invoice.page.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class AddSalesInvoicePage implements OnInit {
  invoiceUuid: string;
  calledFrom: string;
  allowBackDatedInvoices: boolean;
  allowBackDatedInvoicesForDays: number;
  updateStock: boolean;
  minPostingDate: Date = new Date();
  address = {} as any;

  salesInvoice: SalesInvoice;
  dataSource: ItemsDataSource;

  initial: { [key: string]: number } = {
    warehouse: 0,
    territory: 0,
  };
  displayedColumns = ['item', 'stock', 'quantity', 'rate', 'total', 'delete'];

  filteredWarehouseList: Observable<any[]>;
  territoryList: Observable<any[]>;
  filteredCustomerList: Observable<any[]>;

  salesInvoiceForm: FormGroup = new FormGroup(
    {
      warehouse: new FormControl('', [Validators.required]),
      company: new FormControl('', [Validators.required]),
      customer: new FormControl('', [Validators.required]),
      postingDate: new FormControl('', [Validators.required]),
      dueDate: new FormControl('', [Validators.required]),
      territory: new FormControl('', [Validators.required]),
      campaign: new FormControl(false),
      balance: new FormControl(0),
      remarks: new FormControl(''),
      items: new FormArray([], this.itemValidator),
      total: new FormControl(0),
    },
    {
      validators: [this.dueDateValidator, this.creditLimitValidator],
    },
  );
  itemsControl: FormArray = this.f.items as FormArray;
  validateInput: any = ValidateInputSelected;

  get f() {
    return this.salesInvoiceForm.controls;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly salesService: SalesService,
    private readonly itemPriceService: ItemPriceService,
    private readonly snackbar: MatSnackBar,
    private readonly location: Location,
    private readonly router: Router,
    private readonly time: TimeService,
    private readonly storageService: StorageService,
  ) {}

  ngOnInit() {
    this.setupAutocomplete();
    this.checkBackDatedInvoices();
    this.checkUpdateStock();

    this.dataSource = new ItemsDataSource();
    this.salesInvoice = {} as SalesInvoice;
    this.f.postingDate.setValue(new Date());
    this.calledFrom = this.route.snapshot.params.calledFrom;
    if (this.calledFrom === 'edit') {
      this.invoiceUuid = this.route.snapshot.params.invoiceUuid;
      this.salesService.getSalesInvoice(this.invoiceUuid).subscribe({
        next: (res: SalesInvoiceDetails) => {
          this.populateForm(res);
        },
      });
    }

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe({
        next: () => {
          this.salesService
            .getStore()
            .getItems([DEFAULT_COMPANY])
            .then(items => {
              if (items[DEFAULT_COMPANY]) {
                this.f.company.setValue(items[DEFAULT_COMPANY]);
                this.getRemainingBalance();
              } else {
                this.getApiInfo().subscribe({
                  next: res => {
                    this.f.company.setValue(res.defaultCompany);
                  },
                  error: () => {},
                });
              }
            });
        },
        error: () => {},
      });
  }

  setupAutocomplete() {
    this.filteredCustomerList = this.f.customer.valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getCustomerList(value);
      }),
    );

    this.filteredWarehouseList = this.f.warehouse.valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getStore().getItemAsync(WAREHOUSES, value);
      }),
      switchMap(data => {
        if (data && data.length) {
          this.initial.warehouse
            ? null
            : (this.f.warehouse.setValue(data[0]), this.initial.warehouse++);
          return of(data);
        }
        return of([]);
      }),
    );

    this.territoryList = this.f.territory.valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getStore().getItemAsync(TERRITORY, value);
      }),
      switchMap(data => {
        if (data && data.length) {
          this.initial.territory
            ? null
            : (this.f.territory.setValue(data[0]), this.initial.territory++);
          return of(data);
        }
        return of([]);
      }),
    );
  }

  populateForm(payload: SalesInvoiceDetails) {
    this.f.company.setValue(payload.company);
    this.f.territory.setValue(payload.territory);
    this.f.customer.setValue({
      name: payload.customer,
      owner: payload.contact_email,
      customer_name: payload.customer_name,
    });
    this.f.postingDate.setValue(new Date(payload.posting_date));
    this.f.dueDate.setValue(new Date(payload.due_date));
    this.dataSource.loadItems(payload.items);
    payload.items.forEach(item => {
      this.itemsControl.push(new FormControl(item));
    });
    this.calculateTotal(payload.items);
    this.f.campaign.setValue(payload.isCampaign);
    this.f.remarks.setValue(payload.remarks);
    this.f.warehouse.setValue(payload.delivery_warehouse);
    this.updateStockBalance(payload.delivery_warehouse);
    this.getCustomer(payload.customer);
  }

  checkBackDatedInvoices() {
    this.storageService
      .getItem(BACKDATE_PERMISSION)
      .then(res => (this.allowBackDatedInvoices = res));
    this.storageService.getItem(BACKDATE_PERMISSION_FOR_DAYS).then(res => {
      if (res) {
        this.allowBackDatedInvoicesForDays = res;
        this.minPostingDate.setDate(
          new Date().getDate() - this.allowBackDatedInvoicesForDays,
        );
      }
    });
  }

  checkUpdateStock() {
    this.storageService.getItem(UPDATE_SALES_INVOICE_STOCK).then(res => {
      this.updateStock = res;
    });
  }

  dueDateValidator(abstractControl: AbstractControl) {
    const dueDate = new Date(abstractControl.get('dueDate').value);
    if (!dueDate) {
      abstractControl.get('dueDate').setErrors({ required: true });
      return;
    }
    const postingDate = new Date(abstractControl.get('postingDate').value);

    if (dueDate.setHours(0, 0, 0, 0) < postingDate.setHours(0, 0, 0, 0)) {
      abstractControl.get('dueDate').setErrors({ dueDate: true });
    } else return null;
  }

  creditLimitValidator(abstractControl: AbstractControl) {
    const balance = abstractControl.get('balance').value;
    const total = abstractControl.get('total').value;
    if (balance < total) {
      abstractControl.get('balance').markAsTouched();
      abstractControl.get('customer').markAsTouched();
      abstractControl.get('balance').setErrors({ min: true });
    } else abstractControl.get('balance').setErrors(null);
  }

  itemValidator(items: FormArray) {
    if (items.length === 0) {
      return { items: true };
    } else {
      const itemList = items
        .getRawValue()
        .filter(item => item.item_name !== '');
      if (itemList.length !== items.length) {
        return { items: true };
      } else return null;
    }
  }

  addItem() {
    const data = this.dataSource.data();
    const item = {} as Item;
    item.item_name = '';
    item.qty = 0;
    item.rate = 0;
    item.item_code = '';
    item.minimumPrice = 0;
    item.stock = this.f.warehouse.value ? 'Select an Item' : '';
    data.push(item);
    this.itemsControl.push(new FormControl(item));
    this.dataSource.update(data);
  }

  updateStockBalance(warehouse) {
    const data = this.dataSource.data();
    if (warehouse) {
      data.forEach((item, index) => {
        if (item.name) {
          this.getWarehouseStock(item).subscribe({
            next: res => {
              data[index].stock = res;
              this.dataSource.update(data);
            },
          });
        } else {
          data[index].stock = 'Select an Item';
          this.dataSource.update(data);
        }
      });
    } else {
      data.forEach((item, index) => {
        data[index].stock = 'Please select a Warehouse';
        this.dataSource.update(data);
      });
    }
  }

  getWarehouseStock(item: {
    item_code: string;
    bundle_items?: any[];
    has_bundle_item?: boolean;
    is_stock_item?: number;
  }) {
    if (item.bundle_items || item.has_bundle_item || item.is_stock_item === 0) {
      return of(1000000);
    }
    return this.itemPriceService.getStockBalance(
      item.item_code,
      this.f.warehouse.value,
    );
  }

  updateItem(row: Item, index: number, item: Item) {
    if (item == null) {
      return;
    }
    const copy = this.dataSource.data().slice();
    Object.assign(row, item);
    if (this.f.warehouse.value) {
      this.getWarehouseStock(item).subscribe({
        next: res => {
          row.qty = 1;
          row.rate = item.rate;
          row.stock = res;
          this.calculateTotal(this.dataSource.data().slice());
          this.dataSource.update(copy);
        },
      });
    } else {
      row.qty = 1;
      row.rate = item.rate;
      row.stock = 'Please Select a Warehouse';
      this.calculateTotal(this.dataSource.data().slice());
      this.dataSource.update(copy);
    }
    this.itemsControl.controls[index].setValue(item);
  }

  updateQuantity(row: Item, quantity: number) {
    if (quantity == null) {
      return;
    }
    const copy = this.dataSource.data().slice();
    row.qty = quantity;
    this.calculateTotal(this.dataSource.data().slice());
    this.dataSource.update(copy);
  }

  updateRate(row: Item, rate: number) {
    if (rate == null) {
      return;
    }
    const copy = this.dataSource.data().slice();
    if (row.minimumPrice && row.minimumPrice > rate) {
      row.rate = row.minimumPrice;
    } else {
      row.rate = rate;
    }
    this.calculateTotal(this.dataSource.data().slice());

    this.dataSource.update(copy);
  }

  deleteRow(i: number) {
    this.dataSource.data().splice(i, 1);
    this.itemsControl.removeAt(i);
    this.calculateTotal(this.dataSource.data().slice());
    this.dataSource.update(this.dataSource.data());
  }

  customerChanged(customer, postingDate?) {
    if (customer.credit_days) {
      let date;
      postingDate ? (date = new Date(postingDate)) : (date = new Date());
      date.setDate(date.getDate() + customer.credit_days);
      this.f.dueDate.setValue(date);
    }
    this.salesService.getAddress(customer.name).subscribe({
      next: res => {
        this.address = res;
      },
    });
    this.getRemainingBalance();
  }

  navigateBack() {
    this.location.back();
  }

  submitDraft() {
    const isValid = this.salesService.validateItemList(
      this.dataSource.data().map(item => item.item_code),
    );
    if (isValid) {
      const salesInvoiceDetails = {} as SalesInvoiceDetails;
      salesInvoiceDetails.customer = this.f.customer.value.name;
      salesInvoiceDetails.isCampaign = this.f.campaign.value;
      salesInvoiceDetails.company = this.f.company.value;
      salesInvoiceDetails.posting_date = this.getParsedDate(
        this.f.postingDate.value,
      );
      salesInvoiceDetails.posting_time = this.getFrappeTime();
      salesInvoiceDetails.set_posting_time = 1;
      salesInvoiceDetails.due_date = this.getParsedDate(this.f.dueDate.value);
      salesInvoiceDetails.territory = this.f.territory.value;
      salesInvoiceDetails.update_stock = this.updateStock;
      salesInvoiceDetails.total_qty = 0;
      salesInvoiceDetails.total = 0;
      salesInvoiceDetails.contact_email = this.f.customer.value.owner;
      salesInvoiceDetails.customer = this.f.customer.value.name;
      salesInvoiceDetails.customer_name = this.f.customer.value.customer_name;
      salesInvoiceDetails.status = DRAFT;
      salesInvoiceDetails.remarks = this.f.remarks.value;
      salesInvoiceDetails.delivery_warehouse = this.f.warehouse.value;
      const itemList = this.dataSource.data().filter(item => {
        if (item.item_name !== '') {
          item.amount = item.qty * item.rate;
          salesInvoiceDetails.total_qty += item.qty;
          salesInvoiceDetails.total += item.amount;
          item.has_bundle_item =
            item.has_bundle_item || item.bundle_items ? true : false;
          item.is_stock_item = item.is_stock_item;
          return item;
        }
      });
      salesInvoiceDetails.items = itemList;
      if (this.f.customer.value.sales_team) {
        salesInvoiceDetails.sales_team = this.f.customer.value.sales_team;

        for (const sales_person of salesInvoiceDetails.sales_team) {
          sales_person.allocated_amount =
            (sales_person.allocated_percentage / 100) *
            salesInvoiceDetails.total;
        }
      }
      this.validateStock(itemList)
        .pipe(
          switchMap(() => {
            return this.salesService.createSalesInvoice(salesInvoiceDetails);
          }),
        )
        .subscribe({
          next: success => {
            this.router.navigate(
              ['sales', 'view-sales-invoice', success.uuid],
              { replaceUrl: true },
            );
          },
          error: err => {
            // bad way of doing error's do not follow this. message should always be thrown ideally as err.error.message in exception.
            let message = err?.error?.message || '';
            if (!message) {
              try {
                message = err.message ? err.message : JSON.stringify(err);
              } catch {
                message = UPDATE_ERROR;
              }
            }
            this.presentSnackBar(message);
          },
        });
    } else {
      this.presentSnackBar('Error : Duplicate Items added.');
    }
  }

  updateSalesInvoice() {
    const isValid = this.salesService.validateItemList(
      this.dataSource.data().map(item => item.item_code),
    );
    if (isValid) {
      const salesInvoiceDetails = {} as SalesInvoiceDetails;
      salesInvoiceDetails.customer = this.f.customer.value.name;
      salesInvoiceDetails.isCampaign = this.f.campaign.value;
      salesInvoiceDetails.territory = this.f.territory.value;
      salesInvoiceDetails.company = this.f.company.value;
      salesInvoiceDetails.posting_date = this.getParsedDate(
        this.f.postingDate.value,
      );
      salesInvoiceDetails.posting_time = this.getFrappeTime();
      salesInvoiceDetails.set_posting_time = 1;
      salesInvoiceDetails.due_date = this.getParsedDate(this.f.dueDate.value);
      salesInvoiceDetails.update_stock = this.updateStock;
      salesInvoiceDetails.total_qty = 0;
      salesInvoiceDetails.total = 0;
      salesInvoiceDetails.customer = this.f.customer.value.name;
      salesInvoiceDetails.customer_name = this.f.customer.value.customer_name;
      salesInvoiceDetails.delivery_warehouse = this.f.warehouse.value;
      salesInvoiceDetails.status = DRAFT;
      salesInvoiceDetails.remarks = this.f.remarks.value;

      const itemList = this.dataSource.data().filter(item => {
        if (item.item_name !== '') {
          item.amount = item.qty * item.rate;
          salesInvoiceDetails.total_qty += item.qty;
          salesInvoiceDetails.total += item.amount;
          item.has_bundle_item =
            item.has_bundle_item || item.bundle_items ? true : false;
          item.is_stock_item = item.is_stock_item;
          return item;
        }
      });

      salesInvoiceDetails.items = itemList;
      salesInvoiceDetails.uuid = this.invoiceUuid;
      if (this.f.customer.value.sales_team) {
        salesInvoiceDetails.sales_team = this.f.customer.value.sales_team;

        for (const sales_person of salesInvoiceDetails.sales_team) {
          sales_person.allocated_amount =
            (sales_person.allocated_percentage / 100) *
            salesInvoiceDetails.total;
        }
      }
      this.validateStock(itemList)
        .pipe(
          switchMap(() => {
            return this.salesService.updateSalesInvoice(salesInvoiceDetails);
          }),
        )
        .subscribe({
          next: res => {
            this.router.navigate(['sales', 'view-sales-invoice', res.uuid], {
              replaceUrl: true,
            });
          },
          error: err => {
            let message = err?.error?.message || '';
            if (!message) {
              try {
                message = err.message ? err.message : JSON.stringify(err);
              } catch {
                message = UPDATE_ERROR;
              }
            }
            this.presentSnackBar(message);
          },
        });
    } else {
      this.presentSnackBar('Error : Duplicate Items added.');
    }
  }

  calculateTotal(itemList: Item[]) {
    let sum = 0;
    itemList.forEach(item => {
      sum += item.qty * item.rate;
    });
    this.f.total.setValue(sum);
  }

  selectedPostingDate($event) {
    this.customerChanged(this.f.customer.value, $event.value);
  }

  getFrappeTime() {
    const date = new Date();
    return [date.getHours(), date.getMinutes(), date.getSeconds()].join(':');
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

  getOptionText(option) {
    if (option) {
      if (option.customer_name) {
        return `${option.customer_name} (${option.name})`;
      }
      return option.name;
    }
  }

  getApiInfo() {
    return this.salesService.getApiInfo();
  }

  validateStock(itemList: Item[] = []) {
    return this.salesService.getApiInfo().pipe(
      switchMap(info => {
        if (info.validateStock) {
          return from(itemList).pipe(
            mergeMap(item => {
              if (item.qty > item.stock) {
                return throwError({ message: INSUFFICIENT_STOCK_BALANCE });
              }
              return of(item);
            }),
          );
        }
        return of(info);
      }),
      toArray(),
      switchMap(success => of(true)),
    );
  }

  getCustomer(name: string) {
    this.salesService.getCustomer(name).subscribe({
      next: res => {
        this.f.customer.setValue(res);
        this.customerChanged(res);
      },
    });
  }

  getRemainingBalance() {
    forkJoin({
      time: from(this.time.getDateTime(new Date())),
      token: from(this.salesService.getStore().getItem(ACCESS_TOKEN)),
      debtorAccount: this.getApiInfo().pipe(map(res => res.debtorAccount)),
    })
      .pipe(
        switchMap(({ token, time, debtorAccount }) => {
          if (!debtorAccount) {
            return throwError({
              message: 'Please select Debtor Account in settings',
            });
          }
          const headers = {
            [AUTHORIZATION]: BEARER_TOKEN_PREFIX + token,
          };
          return this.itemPriceService.getRemainingBalance(
            debtorAccount,
            time,
            'Customer',
            this.f.customer.value.name,
            this.f.company.value,
            headers,
          );
        }),
      )
      .subscribe({
        next: message => {
          // credit limit defaults to twice the debtor
          let creditLimit = message;
          const creditLimits: {
            company: string;
            credit_limit: number;
          }[] = this.f.customer.value.credit_limits;

          const limits = creditLimits.filter(
            limit => limit.company === this.f.company.value,
          );

          if (limits.length) {
            creditLimit = Number(limits[0].credit_limit) - Number(message);
          }

          this.f.balance.setValue(creditLimit);
        },
        error: error => {
          let frappeError = error.message || UPDATE_ERROR;

          try {
            frappeError = JSON.parse(error.error._server_messages);
            frappeError = JSON.parse(frappeError);
            frappeError = (frappeError as { message?: string }).message;
          } catch {}

          this.presentSnackBar(frappeError);
        },
      });
  }

  presentSnackBar(message: string) {
    this.snackbar.open(message, CLOSE);
  }
}
