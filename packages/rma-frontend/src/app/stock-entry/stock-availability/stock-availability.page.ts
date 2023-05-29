import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { FormControl, FormGroup } from '@angular/forms';

import { StockAvailabilityDataSource } from './stock-availability-datasource';
import { SalesService } from '../../sales-ui/services/sales.service';
import { Observable, of } from 'rxjs';
import { ValidateInputSelected } from '../../common/pipes/validators';
import {
  debounceTime,
  distinctUntilChanged,
  startWith,
  switchMap,
} from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { WAREHOUSES } from '../../constants/app-string';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import {
  STOCK_AVAILABILITY_CSV_FILE,
  STOCK_AVAILABILITY_DOWNLOAD_HEADERS,
} from '../../constants/app-string';
import { StockLedgerService } from '../services/stock-ledger/stock-ledger.service';
@Component({
  selector: 'app-stock-availability',
  templateUrl: './stock-availability.page.html',
  styleUrls: ['./stock-availability.page.scss'],
})
export class StockAvailabilityPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;

  dataSource: StockAvailabilityDataSource;
  defaultCompany: string;
  displayedColumns = [
    'sr_no',
    'item_name',
    'item_code',
    'item_group',
    'item_brand',
    'warehouse',
    'actual_qty',
  ];
  sortQuery: any = {};
  stockAvailabilityForm: FormGroup = new FormGroup({
    item_name: new FormControl(),
    warehouse: new FormControl(),
    item_group: new FormControl(),
    item_brand: new FormControl(),
    zero_stock: new FormControl(),
  });
  filteredItemNameList: Observable<any>;
  filteredWarehouseList: Observable<any[]>;
  filteredItemGroupList: Observable<any>;
  filteredItemBrandList: Observable<any>;
  validateInput: any = ValidateInputSelected;

  get f() {
    return this.stockAvailabilityForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly route: ActivatedRoute,
    private readonly csvService: CsvJsonService,
  ) {}

  ngOnInit() {
    this.setAutoComplete();
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new StockAvailabilityDataSource(this.stockLedgerService);
    this.setFilter();
  }

  navigateBack() {
    this.location.back();
  }

  setAutoComplete() {
    this.filteredItemNameList = this.f.item_name.valueChanges.pipe(
      startWith(''),
      distinctUntilChanged(),
      debounceTime(1000),
      switchMap(value => {
        return this.salesService.getItemList(value);
      }),
    );

    this.filteredWarehouseList = this.f.warehouse.valueChanges.pipe(
      startWith(''),
      distinctUntilChanged(),
      debounceTime(1000),
      switchMap(value => {
        return this.salesService.getStore().getItemAsync(WAREHOUSES, value);
      }),
    );

    this.filteredItemGroupList = this.f.item_group.valueChanges.pipe(
      startWith(''),
      distinctUntilChanged(),
      debounceTime(1000),
      switchMap(value => {
        return this.salesService.getItemGroupList(value);
      }),
      switchMap(data => {
        return of(data);
      }),
    );

    this.filteredItemBrandList = this.f.item_brand.valueChanges.pipe(
      startWith(''),
      distinctUntilChanged(),
      debounceTime(1000),
      switchMap(value => {
        return this.salesService.getItemBrandList(value);
      }),
      switchMap(data => {
        return of(data);
      }),
    );
  }

  clearFilters() {
    this.stockAvailabilityForm.reset();
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      undefined,
      this.sortQuery,
    );
  }

  getUpdate(event) {
    const query: any = {};
    if (this.f.item_name.value)
      query.item_code = this.f.item_name.value.item_code;
    if (this.f.warehouse.value) query.warehouse = this.f.warehouse.value;
    if (this.f.item_group.value) query.item_group = this.f.item_group.value;
    if (this.f.item_brand.value) query.item_brand = this.f.item_brand.value;
    if (this.f.zero_stock.value) query.zero_stock = this.f.zero_stock_value;

    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
      this.sortQuery,
    );
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.item_name.value)
      query.item_code = this.f.item_name.value.item_code;
    if (this.f.warehouse.value) query.warehouse = this.f.warehouse.value;
    if (this.f.item_group.value) query.item_group = this.f.item_group.value;
    if (this.f.item_brand.value) query.item_brand = this.f.item_brand.value;
    if (this.f.zero_stock.value) query.zero_stock = this.f.zero_stock.value;

    if (event) {
      for (const key of Object.keys(event)) {
        if (key === 'active' && event.direction !== '') {
          this.sortQuery[event[key]] = event.direction;
        }
      }
    }

    this.sortQuery =
      Object.keys(this.sortQuery).length === 0
        ? { item_code: 'DESC' }
        : this.sortQuery;

    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
      this.sortQuery,
    );
  }

  downloadServiceInvoices() {
    const result: any = this.serializeStockAvailabilityObject(
      this.dataSource.data,
    );
    this.csvService.downloadAsCSV(
      result,
      STOCK_AVAILABILITY_DOWNLOAD_HEADERS,
      `${STOCK_AVAILABILITY_CSV_FILE}`,
    );
  }

  serializeStockAvailabilityObject(data: any) {
    const serializedArray: any = [];
    data.forEach(element => {
      if (
        element.item.item_name &&
        element.item.item_code &&
        element.item.item_group &&
        element.item.brand &&
        element._id.warehouse &&
        element.stockAvailability
      ) {
        const obj1: any = {
          item_name: element.item.item_name,
          item_code: element.item.item_code,
          item_group: element.item.item_group,
          brand: element.item.brand,
          warehouse: element._id.warehouse,
          stockAvailability: element.stockAvailability,
        };
        serializedArray.push(obj1);
      }
    });
    return serializedArray;
  }

  getItemName(option: any) {
    return option ? option.item_name : '';
  }
}
