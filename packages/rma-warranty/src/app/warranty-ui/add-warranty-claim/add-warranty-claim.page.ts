import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TimeService } from '../../api/time/time.service';
import { AddWarrantyService } from './add-warranty.service';
import {
  startWith,
  switchMap,
  map,
  debounceTime,
  catchError,
} from 'rxjs/operators';
import { LoadingController } from '@ionic/angular';
import {
  WarrantyState,
  SerialNoDetails,
  WarrantyItem,
  WarrantyClaimsDetails,
  WarrantyBulkProducts,
} from '../../common/interfaces/warranty.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CATEGORY,
  CLOSE,
  DURATION,
  WARRANTY_TYPE,
} from './../../constants/app-string';
import {
  ITEM_BRAND_FETCH_ERROR,
  USER_SAVE_ITEM_SUGGESTION,
  ITEM_NOT_FOUND,
} from '../../constants/messages';
import { ActivatedRoute, Router } from '@angular/router';
import { AUTH_SERVER_URL, TIME_ZONE } from '../../constants/storage';
import { DateTime } from 'luxon';
import { WarrantyService } from '../warranty-tabs/warranty.service';
import { ValidateInputSelected } from '../../common/pipes/validators';
import { Observable, of } from 'rxjs';
import { MatTable } from '@angular/material/table';

@Component({
  selector: 'app-add-warranty-claim',
  templateUrl: './add-warranty-claim.page.html',
  styleUrls: ['./add-warranty-claim.page.scss'],
})
export class AddWarrantyClaimPage implements OnInit {
  @ViewChild(MatTable) table: MatTable<any>;
  validateInput: any = ValidateInputSelected;
  warrantyObject: WarrantyClaimsDetails;
  contact = {} as any;
  filteredCustomerList: any;
  claimList: any;
  categoryList: any;
  getSerialData: SerialNoDetails;
  warrantyState: WarrantyState;
  bulkProducts: WarrantyBulkProducts[] = [];
  productList: any;
  territoryList: Observable<any[]>;
  itemDetail: any;
  problemList: any;
  route: string;
  displayedColumns = [
    'serial_no',
    'claim_type',
    'invoice_no',
    'warranty_end_date',
    'item_name',
    'product_brand',
    'problem',
    'item_code',
    'remove',
  ];
  warrantyClaimForm = new FormGroup({
    warranty_end_date: new FormControl(''),
    claim_type: new FormControl('', [Validators.required]),
    category: new FormControl(''),
    received_on: new FormControl(''),
    delivery_date: new FormControl(''),
    receiving_branch: new FormControl(''),
    delivery_branch: new FormControl(''),
    product_brand: new FormControl(''),
    problem: new FormControl(''),
    problem_details: new FormControl(''),
    remarks: new FormControl(''),
    customer_contact: new FormControl(),
    customer_address: new FormControl(),
    third_party_name: new FormControl(''),
    third_party_contact: new FormControl(''),
    third_party_address: new FormControl(''),
    product_name: new FormControl(''),
    customer_name: new FormControl(''),
    serial_no: new FormControl(''),
    invoice_no: new FormControl(''),
  });

  constructor(
    private location: Location,
    private readonly time: TimeService,
    private readonly addWarrantyService: AddWarrantyService,
    private readonly loadingController: LoadingController,
    private readonly snackbar: MatSnackBar,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly warrantyClaim: WarrantyService,
  ) {}

  async ngOnInit() {
    if (this.activatedRoute.snapshot.params.name === 'edit') {
      this.clearAllControlValidators();
      this.setValues();
    }
    this.route = this.activatedRoute.snapshot.params.name;
    this.categoryList = ['Bulk', 'Single'];
    this.claimList = ['Warranty', 'Non Warranty', 'Non Serial Warranty'];
    this.warrantyState = {
      serial_no: { disabled: false, active: true },
      invoice_no: { disabled: false, active: true },
      warranty_end_date: { disabled: false, active: true },
      customer_contact: { disabled: true, active: true },
      customer_address: { disabled: true, active: true },
      product_name: { disabled: true, active: true },
      customer_name: { disabled: true, active: true },
      product_brand: { disabled: true, active: true },
      third_party_name: { disabled: true, active: true },
      third_party_contact: { disabled: true, active: true },
      third_party_address: { disabled: true, active: true },
      category: { disabled: true, active: true },
    };
    this.createForm();
    this.setDefaults();
    this.setAutoComplete();
  }

  setAutoComplete() {
    this.filteredCustomerList = this.warrantyClaimForm.controls.customer_name.valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      this.addWarrantyService.getRelayedCustomerList(),
    );

    this.productList = this.warrantyClaimForm.controls.product_name.valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      this.addWarrantyService.getItemList(),
    );

    this.problemList = this.warrantyClaimForm.controls.problem.valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      switchMap(value => {
        return this.addWarrantyService.getProblemList(value);
      }),
      map(res => res.docs),
    );

    this.addWarrantyService
      .getStorage()
      .getItem('territory')
      .then(territory => {
        this.territoryList = of(territory);
      });
  }
  async setDefaults() {
    this.warrantyClaimForm.controls.received_on.setValue(
      await (await this.getDateTime(new Date())).date,
    );
    this.warrantyClaimForm.controls.delivery_date.setValue(
      await this.getDeliveryDate(new Date()),
    );
    this.warrantyClaimForm.controls.claim_type.setValue(
      this.f.claim_type.value ? this.f.claim_type.value : this.claimList[0],
    );
    this.warrantyClaimForm.controls.category.setValue(CATEGORY.SINGLE);
    this.getFormState(this.warrantyClaimForm.controls.claim_type.value);
    this.territoryList.subscribe({
      next: territory => {
        this.warrantyClaimForm.controls.receiving_branch.setValue(
          territory.find(branch => {
            return branch;
          }),
        );
      },
    });
  }

  clearAllControlValidators() {
    Object.keys(this.warrantyClaimForm.controls).forEach(element => {
      this.warrantyClaimForm.get(element).clearValidators();
      this.warrantyClaimForm.get(element).updateValueAndValidity();
    });
  }

  setValues() {
    this.warrantyClaim
      .getWarrantyClaim(this.activatedRoute.snapshot.params.uuid)
      .subscribe({
        next: (res: WarrantyClaimsDetails) => {
          if (res.set === CATEGORY.BULK) {
            this.warrantyClaimForm.get('category').setValue(res.category);
            this.warrantyObject = res;
            return this.warrantyObject;
          }
          this.warrantyObject = res;
          Object.keys(this.warrantyClaimForm.controls).forEach(element => {
            switch (element) {
              case 'product_name':
                this.warrantyClaimForm
                  .get(element)
                  .setValue({ item_name: res.item_name });
                break;
              case 'customer_name':
                this.warrantyClaimForm
                  .get(element)
                  .setValue({ customer_name: res.customer });
                break;
              case 'problem':
                this.warrantyClaimForm
                  .get(element)
                  .setValue({ problem_name: res.problem });
                break;
              default:
                this.warrantyClaimForm.get(element).setValue(res[element]);
                break;
            }
          });
        },
      });
  }

  mapUpdateClaim() {
    const updatePayload = {} as WarrantyClaimsDetails;
    updatePayload.uuid = this.warrantyObject.uuid;
    Object.keys(this.warrantyClaimForm.controls).forEach(element => {
      switch (element) {
        case 'product_name':
          if (
            this.warrantyObject.item_name !==
            this.warrantyClaimForm.get(element).value.item_name
          )
            updatePayload.item_name = this.warrantyClaimForm.get(
              element,
            ).value.item_name;

          break;
        case 'customer_name':
          if (
            this.warrantyObject.customer !==
            this.warrantyClaimForm.get(element).value.name
          ) {
            updatePayload.customer = this.warrantyClaimForm.get(
              element,
            ).value.customer_name;
            updatePayload.customer_code = this.warrantyClaimForm.get(
              element,
            ).value.name;
          }
          break;
        case 'problem':
          if (
            this.warrantyObject[element] !==
            this.warrantyClaimForm.get(element).value.problem_name
          )
            updatePayload.problem = this.warrantyClaimForm.get(
              element,
            ).value.problem_name;
          break;
        default:
          if (
            this.warrantyObject[element] !==
            this.warrantyClaimForm.get(element).value
          )
            updatePayload[element] = this.warrantyClaimForm.get(element).value;
          break;
      }
    });
    return updatePayload;
  }

  async updateClaim() {
    const loading = await this.loadingController.create();
    await loading.present();
    const payload = this.mapUpdateClaim();
    if (this.warrantyObject.set === CATEGORY.BULK) {
      payload.bulk_products = this.bulkProducts;
      payload.category = this.warrantyObject.category;
      payload.set = this.warrantyObject.set;
      payload.subclaim_state = 'Draft';
    }
    this.addWarrantyService.updateWarrantyClaim(payload).subscribe({
      next: () => {
        loading.dismiss();
        this.router.navigate(['/warranty']);
      },
      error: err => {
        loading.dismiss();
        this.snackbar.open(err?.error.message, 'Close', {
          duration: DURATION,
        });
      },
    });
  }

  getFormState(state) {
    switch (state) {
      case 'Non Serial Warranty':
        this.warrantyState = {
          serial_no: { disabled: true, active: false },
          invoice_no: { disabled: true, active: false },
          warranty_end_date: { disabled: true, active: true },
          customer_contact: { disabled: false, active: true },
          customer_address: { disabled: false, active: true },
          product_name: { disabled: true, active: true },
          customer_name: { disabled: true, active: true },
          product_brand: { disabled: false, active: true },
          third_party_name: { disabled: true, active: true },
          third_party_contact: { disabled: true, active: true },
          third_party_address: { disabled: true, active: true },
          category: { disabled: true, active: true },
        };
        this.isDisabled();
        this.clearAllValidators('Non Serial Warranty');
        break;

      case 'Third Party Warranty':
        this.warrantyState = {
          serial_no: { disabled: true, active: true },
          invoice_no: { disabled: false, active: false },
          warranty_end_date: { disabled: true, active: true },
          customer_contact: { disabled: true, active: true },
          customer_address: { disabled: true, active: true },
          product_name: { disabled: true, active: true },
          customer_name: { disabled: true, active: true },
          product_brand: { disabled: true, active: true },
          third_party_name: { disabled: true, active: true },
          third_party_contact: { disabled: true, active: true },
          third_party_address: { disabled: true, active: true },
          category: { disabled: true, active: true },
        };
        this.isDisabled();
        this.warrantyClaimForm.controls.invoice_no.reset();
        this.clearAllValidators('Third Party Warranty');
        break;

      default:
        this.warrantyState = {
          serial_no: { disabled: true, active: true },
          invoice_no: { disabled: false, active: true },
          warranty_end_date: { disabled: false, active: true },
          customer_contact: { disabled: false, active: true },
          customer_address: { disabled: false, active: true },
          product_name: { disabled: false, active: true },
          customer_name: { disabled: false, active: true },
          product_brand: { disabled: false, active: true },
          third_party_name: { disabled: true, active: true },
          third_party_contact: { disabled: true, active: true },
          third_party_address: { disabled: true, active: true },
          category: { disabled: true, active: true },
        };
        this.isDisabled();
        this.clearAllValidators('Warranty');

        break;
    }
  }

  setValidators(type: string) {
    const obj = {
      Warranty: ['serial_no', 'invoice_no', 'customer_name'],
      'Non Serial Warranty': ['customer_name'],
      'Third Party Warranty': ['third_party_name', 'customer_name'],
    };
    obj[type].forEach(element => {
      this.warrantyClaimForm.get(element).setValidators(Validators.required);
      this.warrantyClaimForm.get(element).updateValueAndValidity();
    });
  }

  clearAllValidators(type: string) {
    const common_control = [
      'product_brand',
      'problem',
      'claim_type',
      'received_on',
      'delivery_date',
      'receiving_branch',
      'category',
      'warranty_end_date',
    ];
    this.clearAllControlValidators();
    common_control.forEach(element => {
      this.warrantyClaimForm.get(element).setValidators(Validators.required);
      this.warrantyClaimForm.get(element).updateValueAndValidity();
    });
    this.setValidators(type);
  }

  isDisabled() {
    Object.keys(this.warrantyState).forEach(key => {
      this.warrantyState[key].disabled
        ? this.warrantyClaimForm.controls[key].enable()
        : this.warrantyClaimForm.controls[key].disable();
    });
  }

  async getDateTime(date: Date) {
    const luxonDateTime = await this.time.getDateAndTime(date);
    return { date: luxonDateTime.date, time: luxonDateTime.time };
  }

  async getDeliveryDate(date: Date) {
    date.setDate(date.getDate() + 3);
    return (await this.getDateTime(date)).date;
  }

  get f() {
    return this.warrantyClaimForm.controls;
  }

  navigateBack() {
    this.location.back();
  }

  async createClaim() {
    if (!this.warrantyClaimForm.valid) {
      this.snackbar.open('Please enter missing fields.', CLOSE, {
        duration: 4500,
      });
      this.warrantyClaimForm.markAllAsTouched();
      return;
    }
    const loading = await this.loadingController.create();
    await loading.present();
    const detail = await this.assignFields();
    if (this.warrantyClaimForm.controls.category.value === CATEGORY.BULK) {
      if (detail.bulk_products?.length >= 1) {
        return this.addWarrantyService
          .createBulkWarrantyClaim(detail)
          .subscribe({
            next: () => {
              loading.dismiss();
              this.router.navigate(['/warranty']);
            },
            error: err => {
              loading.dismiss();
              this.snackbar.open(err?.error?.message, 'Close', {
                duration: 3000,
              });
            },
          });
      }
      loading.dismiss();
      this.snackbar.open(`Please use single claim for one product`, CLOSE, {
        duration: DURATION,
      });
    }

    return this.addWarrantyService.createWarrantyClaim(detail).subscribe({
      next: () => {
        loading.dismiss();
        this.router.navigate(['/warranty']);
      },
      error: error => {
        loading.dismiss();
        this.getMessage(error?.error?.message || 'Error in creating claim.');
      },
    });
  }

  async assignFields() {
    const warrantyClaimDetails = {} as WarrantyClaimsDetails;
    warrantyClaimDetails.received_on = this.warrantyClaimForm.controls.received_on.value;
    warrantyClaimDetails.delivery_date = this.warrantyClaimForm.controls.delivery_date.value;
    warrantyClaimDetails.receiving_branch = this.warrantyClaimForm.controls.receiving_branch.value;
    warrantyClaimDetails.delivery_branch = this.warrantyClaimForm.controls.delivery_branch.value;
    warrantyClaimDetails.category = this.warrantyClaimForm.controls.category.value;
    switch (this.warrantyClaimForm.controls.category.value) {
      case CATEGORY.BULK:
        warrantyClaimDetails.bulk_products = this.bulkProducts;
        break;
      case CATEGORY.SINGLE:
        warrantyClaimDetails.set = CATEGORY.SINGLE;
        warrantyClaimDetails.claim_type = this.warrantyClaimForm.controls.claim_type.value;
        warrantyClaimDetails.product_brand = this.warrantyClaimForm.controls.product_brand.value;
        warrantyClaimDetails.problem = this.warrantyClaimForm.controls.problem.value.problem_name;
        warrantyClaimDetails.problem_details = this.warrantyClaimForm.controls.problem_details.value;
        warrantyClaimDetails.item_name = this.warrantyClaimForm.controls.product_name.value.item_name;
        warrantyClaimDetails.item_code = this.itemDetail.item_code;
        break;

      default:
        this.snackbar.open(`Please select valid category`, CLOSE, {
          duration: DURATION,
        });
        break;
    }
    warrantyClaimDetails.remarks = this.warrantyClaimForm.controls.remarks.value;
    warrantyClaimDetails.customer_contact = this.warrantyClaimForm.controls.customer_contact.value;
    warrantyClaimDetails.customer_address = this.warrantyClaimForm.controls.customer_address.value;
    warrantyClaimDetails.third_party_name = this.warrantyClaimForm.controls.third_party_name.value;
    warrantyClaimDetails.third_party_contact = this.warrantyClaimForm.controls.third_party_contact.value;
    warrantyClaimDetails.third_party_address = this.warrantyClaimForm.controls.third_party_address.value;
    warrantyClaimDetails.customer = this.warrantyClaimForm.controls.customer_name.value.customer_name;
    warrantyClaimDetails.warranty_claim_date = this.warrantyClaimForm.controls.received_on.value;
    warrantyClaimDetails.customer_code = this.contact.name;
    warrantyClaimDetails.serial_no = this.warrantyClaimForm.controls.serial_no.value;
    warrantyClaimDetails.invoice_no = this.warrantyClaimForm.controls.invoice_no.value;
    warrantyClaimDetails.warranty_end_date = this.warrantyClaimForm.controls.warranty_end_date.value;
    warrantyClaimDetails.posting_time = await (
      await this.getDateTime(new Date())
    ).time;
    return warrantyClaimDetails;
  }

  createForm() {}

  async customerChanged(customer) {
    const loading = await this.loadingController.create();
    await loading.present();
    return this.addWarrantyService.getRelayCustomer(customer.name).subscribe({
      next: (res: any) => {
        // this clearly needs rework. dont try to optimize. rewrite it.
        loading.dismiss();
        this.contact = res;
        if (!res) {
          this.getMessage('Failed to fetch customer.');
          return;
        }
        this.warrantyClaimForm.controls.customer_name.setValue(res);
        if (!res.customer_primary_address) {
          if (!res.mobile_no) {
            this.snackbar.open(
              'Customer Address and Contact Not found',
              'Close',
              {
                duration: DURATION,
              },
            );
            this.warrantyClaimForm.controls.customer_contact.setValue('');
            this.warrantyClaimForm.controls.customer_address.setValue('');
          } else {
            this.snackbar.open('Address Not found', 'Close', {
              duration: DURATION,
            });
            this.warrantyClaimForm.controls.customer_contact.setValue(
              this.contact.mobile_no,
            );
          }
        } else if (!res.mobile_no) {
          this.snackbar.open('Customer Contact Not found', 'Close', {
            duration: DURATION,
          });
          this.warrantyClaimForm.controls.customer_address.setValue(
            this.contact.customer_primary_address,
          );
        } else {
          this.warrantyClaimForm.controls.customer_contact.setValue(
            this.contact.mobile_no,
          );
          this.warrantyClaimForm.controls.customer_address.setValue(
            this.contact.customer_primary_address,
          );
        }
      },
      error: err => {
        loading.dismiss();
        this.snackbar.open(
          err?.error?.message || 'Error fetching customer',
          CLOSE,
          { duration: 4200 },
        );
      },
    });
  }
  getOptionText(option) {
    if (option) return option.customer_name;
  }

  getOption(option) {
    if (option) return option;
  }

  getItemOption(option) {
    if (option) return option.item_name;
  }

  getBranchOption(option) {
    if (option) return option;
  }

  getProblemOption(option) {
    if (option) return option.problem_name;
  }

  checkSerial(serialNo) {
    return this.addWarrantyService.getSerial(serialNo).pipe(
      switchMap((res: SerialNoDetails) => {
        if (res.claim_no) {
          this.getMessage(`Claim already exists serial no ${res.serial_no}`);
          return of(false);
        }
        if (!res.customer) {
          this.getMessage(
            'Serial not sold or serials is not linked to customer.',
          );
          return of(false);
        }
        if (
          res.delivery_note ? res.delivery_note.split('-')[0] === 'WSDR' : false
        ) {
          this.getMessage('Cannot Create Claim of  Stocked Serial');
          return of(false);
        }
        return of(true);
      }),
      catchError(err => {
        return of(err);
      }),
    );
  }

  async serialChanged(name) {
    this.claimList = [
      'Warranty',
      'Non Warranty',
      'Non Serial Warranty',
      'Third Party Warranty',
    ];
    this.warrantyClaimForm.controls.claim_type.enable();
    const timeZone = await this.addWarrantyService
      .getStorage()
      .getItem(TIME_ZONE);
    this.addWarrantyService.getSerial(name).subscribe({
      next: (res: SerialNoDetails) => {
        this.getSerialData = res;
        if (res.claim_no) {
          this.getMessage(`Claim already exists serial no ${res.serial_no}`);
          return false;
        }
        if (!res.customer) {
          this.getMessage(
            'Serial not sold or serials is not linked to customer.',
          );
          return false;
        }
        if (
          res.delivery_note ? res.delivery_note.split('-')[0] === 'WSDR' : false
        ) {
          this.getMessage('Cannot Create Claim of  Stocked Serial');
          return false;
        }

        if (!this.getSerialData.warranty.salesWarrantyDate) {
          this.warrantyClaimForm.controls.claim_type.setValue(
            WARRANTY_TYPE.NON_WARRANTY,
          );
        } else {
          if (
            DateTime.fromISO(this.warrantyClaimForm.controls.received_on.value)
              .setZone(timeZone)
              .toFormat('yyyy-MM-dd') <
            DateTime.fromISO(this.getSerialData.warranty.salesWarrantyDate)
              .setZone(timeZone)
              .toFormat('yyyy-MM-dd')
          ) {
            this.warrantyClaimForm.controls.claim_type.setValue(
              WARRANTY_TYPE.WARRANTY,
            );
          } else {
            this.warrantyClaimForm.controls.claim_type.setValue(
              WARRANTY_TYPE.NON_WARRANTY,
            );
          }
        }
        this.warrantyClaimForm.controls.warranty_end_date.setValue(
          res.warranty.salesWarrantyDate,
        );
        this.warrantyClaimForm.controls.invoice_no.setValue(
          res.sales_invoice_name,
        );
        this.warrantyClaimForm.controls.warranty_end_date.setValue(
          res.warranty.salesWarrantyDate
            ? new Date(res.warranty.salesWarrantyDate)
            : '',
        );
        this.warrantyClaimForm.controls.product_name.setValue({
          item_name: res.item_name,
        });
        this.warrantyClaimForm.controls.customer_name.setValue({
          name: res.customer,
        });
        this.itemOptionChanged({ item_code: res.item_code });
        this.customerChanged({ name: res.customer });
      },
      error: error => {
        this.snackbar.open(
          error?.error?.message || 'Error Fetching provided serial.',
          'Close',
          {
            duration: DURATION,
          },
        );
      },
    });
  }

  getMessage(message) {
    this.snackbar.open(message, CLOSE, {
      duration: DURATION,
    });
  }

  dateChanges(option) {
    this.getDateTime(option).then(date => {
      switch (this.warrantyClaimForm.controls.claim_type.value) {
        case WARRANTY_TYPE.WARRANTY:
          this.validateWarrantyDate(date);

        case WARRANTY_TYPE.NON_WARRANTY:
          this.validateWarrantyDate(date);

        default:
          this.warrantyClaimForm.controls.claim_type.setValue(
            this.warrantyClaimForm.controls.claim_type.value,
          );
          break;
      }
    });
  }

  validateWarrantyDate(date: any) {
    if (this.warrantyClaimForm.controls.received_on.value < date.date) {
      this.warrantyClaimForm.controls.claim_type.setValue(
        WARRANTY_TYPE.WARRANTY,
      );
      return '';
    }
    this.warrantyClaimForm.controls.claim_type.setValue(
      WARRANTY_TYPE.NON_WARRANTY,
    );
    return '';
  }

  itemOptionChanged(option) {
    this.addWarrantyService.getItem(option.item_code).subscribe({
      next: (res: WarrantyItem) => {
        this.itemDetail = res;
        if (!res.brand) {
          this.getItemBrandFromERP(res.item_code);
        }

        if (res.has_serial_no) {
          this.f.serial_no.enable();
        } else {
          this.f.serial_no.setValue('');
          this.f.serial_no.disable();
        }

        this.warrantyClaimForm.controls.product_brand.setValue(res.brand);
      },
      error: ({ message }) => {
        if (!message) message = `${ITEM_NOT_FOUND}`;
        this.snackbar.open(message, 'Close', {
          duration: DURATION,
        });
      },
    });
  }

  getItemBrandFromERP(item_code: string) {
    this.addWarrantyService.getItemBrandFromERP(item_code).subscribe({
      next: res => {
        if (!res.brand) {
          this.snackbar.open(ITEM_BRAND_FETCH_ERROR, 'Close', {
            duration: DURATION,
          });
        } else {
          this.snackbar
            .open(USER_SAVE_ITEM_SUGGESTION, 'open item', {
              duration: 5500,
            })
            .onAction()
            .subscribe(() => {
              this.openERPItem(item_code);
            });
          this.warrantyClaimForm.controls.product_brand.setValue(res.brand);
        }
      },
      error: err => {
        this.snackbar.open(ITEM_NOT_FOUND, 'Close', { duration: DURATION });
      },
    });
  }

  openERPItem(item_code: string) {
    this.addWarrantyService
      .getStorage()
      .getItem(AUTH_SERVER_URL)
      .then(auth_url => {
        window.open(`${auth_url}/desk#Form/Item/${item_code}`, '_blank');
      });
  }

  appendProduct() {
    if (this.validateProduct()) {
      this.checkSerial(
        this.warrantyClaimForm.controls.serial_no.value,
      ).subscribe({
        next: res => {
          if (res) {
            this.bulkProducts = this.bulkProducts.concat({
              received_on: this.warrantyClaimForm.controls.received_on.value,
              delivery_date: this.warrantyClaimForm.controls.delivery_date
                .value,
              remarks: this.warrantyClaimForm.controls.remarks.value,
              customer_contact: this.warrantyClaimForm.controls.customer_contact
                .value,
              customer_address: this.warrantyClaimForm.controls.customer_address
                .value,
              third_party_name: this.warrantyClaimForm.controls.third_party_name
                .value,
              third_party_contact: this.warrantyClaimForm.controls
                .third_party_contact.value,
              third_party_address: this.warrantyClaimForm.controls
                .third_party_address.value,
              customer: this.warrantyClaimForm.controls.customer_name.value
                .customer_name,
              warranty_claim_date: this.warrantyClaimForm.controls.received_on
                .value,
              customer_code: this.contact.name,
              claim_type: this.warrantyClaimForm.controls.claim_type.value,
              product_brand: this.warrantyClaimForm.controls.product_brand
                .value,
              problem: this.warrantyClaimForm.controls.problem.value
                .problem_name,
              problem_details: this.warrantyClaimForm.controls.problem_details
                .value,
              item_name: this.warrantyClaimForm.controls.product_name.value
                .item_name,
              item_code: this.itemDetail.item_code,
              serial_no: this.warrantyClaimForm.controls.serial_no.value,
              invoice_no: this.warrantyClaimForm.controls.invoice_no.value,
              warranty_end_date: this.warrantyClaimForm.controls
                .warranty_end_date.value,
              delivery_branch: this.warrantyClaimForm.controls.delivery_branch
                .value,
            });
          }
        },
      });
    }
  }

  validateProduct() {
    let check: boolean;
    if (this.bulkProducts.length) {
      for (const product of this.bulkProducts) {
        if (
          product.serial_no ===
            this.warrantyClaimForm.controls.serial_no.value &&
          product.claim_type !== 'Non Serial Warranty'
        ) {
          this.snackbar.open('Serial Already Exists', CLOSE, {
            duration: DURATION,
          });
          check = false;
        } else {
          check = true;
        }
      }
    } else {
      check = true;
    }
    return check;
  }

  getUpdate(event) {}

  branchOptionChanged(option) {}

  clearProductDetails() {
    this.warrantyClaimForm.controls.serial_no.enable();
    this.warrantyClaimForm.controls.claim_type.enable();
    this.warrantyClaimForm.controls.serial_no.reset();
    this.warrantyClaimForm.controls.warranty_end_date.reset();
    this.warrantyClaimForm.controls.product_name.reset();
    this.warrantyClaimForm.controls.product_brand.reset();
    this.warrantyClaimForm.controls.problem.reset();
    this.warrantyClaimForm.controls.problem_details.reset();
    this.warrantyClaimForm.controls.remarks.reset();
    this.warrantyClaimForm.controls.invoice_no.reset();
    this.setAutoComplete();
  }

  removeSubclaim(index: number) {
    this.bulkProducts.splice(index, 1);
    this.table.renderRows();
  }
}
