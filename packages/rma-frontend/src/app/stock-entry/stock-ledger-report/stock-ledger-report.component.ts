import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable, of } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { ValidateInputSelected } from 'src/app/common/pipes/validators';
import { SalesService } from '../../sales-ui/services/sales.service';
import { WAREHOUSES } from '../../constants/app-string';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';
import { RELAY_LIST_PROJECT_ENDPOINT } from 'src/app/constants/url-strings';
import { StockLedgerDataSource } from './stock-ledger-datasource';

@Component({
  selector: 'app-stock-ledger-report',
  templateUrl: './stock-ledger-report.component.html',
  styleUrls: ['./stock-ledger-report.component.scss'],
})
export class StockLedgerReportComponent implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  search:any
  // range = new FormGroup({
    
  // });
  stockLedgerForm: FormGroup
  validateInput: any = ValidateInputSelected;
  filteredStockAvailabilityList: Observable<any>;
  filteredWarehouseList: Observable<any[]>;
  filteredItemGroupList: Observable<any>;
  filteredItemBrandList: Observable<any>;
  filteredProjectList: Observable<any[]>;
  stockUomList= []
  filters: any = [];
  countFilter: any = {};
  dataSource: StockLedgerDataSource;
  // dataSource: StockBalanceSummaryDataSource;

  displayedColumns = [
    'modified',
    'company',
    'item_code',
    'voucher_no',
    'batch_no',
    'brand',
    'warehouse',
    'stock_uom',
    'actual_qty',
    'incoming_rate',
    'valuation_rate',

  ];

  get f() {
    return this.stockLedgerForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly stockEntryService: StockEntryService,
  ) {}

  ngOnInit() {
    this.createFormGroup();
    this.search = ''

    this.dataSource = new StockLedgerDataSource(this.salesService);
    this.dataSource.loadItems(0, 30, this.filters, this.countFilter);

    this.stockEntryService.getStockUomList().subscribe(res=>{
      res.forEach(uom => {
        this.stockUomList.push(uom)
      });
    })

    this.filteredStockAvailabilityList = this.stockLedgerForm
      .get('item_name')
      .valueChanges.pipe(
        startWith(''),
        switchMap(value => {
          return this.salesService.getItemList(value);
        }),
      );

    this.filteredWarehouseList = this.stockLedgerForm
    .get('warehouse')
    .valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getStore().getItemAsync(WAREHOUSES, value);
      }),
    );

    this.filteredItemGroupList = this.stockLedgerForm
      .get('excel_item_group')
      .valueChanges.pipe(
        startWith(''),
        switchMap(value => {
          return this.salesService.getItemGroupList(value);
        }),
        switchMap(data => {
          return of(data);
        }),
      );

    this.filteredItemBrandList = this.stockLedgerForm
    .get('excel_item_brand')
    .valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        return this.salesService.getItemBrandList(value);
      }),
      switchMap(data => {
        return of(data);
      }),
    );

    this.filteredProjectList = this.stockLedgerForm
    .get('project')
    .valueChanges.pipe(
      startWith(''),
      switchMap(value => {
        const filter = `[["name", "like", "%${value}%"]]`;
        return this.stockEntryService.getFilteredAccountingDimensions(
          RELAY_LIST_PROJECT_ENDPOINT,
          filter,
        );
      }),
    );

    

  }

  navigateBack() {
    this.location.back();
  }

  createFormGroup() {
    this.stockLedgerForm = new FormGroup({
      company: new FormControl('Excel Technologies Ltd.'),
      item_name: new FormControl(),
      warehouse: new FormControl(),
      excel_item_group: new FormControl(),
      excel_item_brand: new FormControl(),
      start_date: new FormControl([Validators.required]),
      end_date: new FormControl([Validators.required]),
      voucher: new FormControl(),
      project: new FormControl(),
      stock_uom: new FormControl(),
      batch_no: new FormControl(),
      
    });
  }

  clearFilters() {
    this.f.item_name.setValue('');
    this.f.warehouse.setValue('');
    this.f.excel_item_brand.setValue('');
    this.f.excel_item_group.setValue('');
    this.f.voucher.setValue('');
    this.f.project.setValue('');
    this.f.stock_uom.setValue('');
    this.f.batch_no.setValue('');
    this.f.company.setValue('Excel Technologies Ltd.');
    this.setFilter();
  }

  getStockAvailabilityOption(option) {
    if (option) {
      return option.item_name;
    }
  }

  setFilter(event?) {
    this.search = JSON.stringify({
      start_date: this.stockLedgerForm.controls.start_date.value,
      end_date: this.stockLedgerForm.controls.end_date.value,
    });
    // this.dataSource.loadItems(
    //   this.search,
    //   this.sort.direction,
    //   event?.pageIndex || 0,
    //   event?.pageSize || 30,
    // );
  }
  getUpdate(event) {
    this.dataSource.loadItems(
      event.pageIndex,
      event.pageSize,
      this.filters,
      this.countFilter,
    );
  }

  downloadServiceInvoices() {}


}
