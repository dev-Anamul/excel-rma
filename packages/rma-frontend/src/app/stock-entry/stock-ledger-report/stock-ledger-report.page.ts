import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  startWith,
  switchMap,
} from 'rxjs/operators';
import { ValidateInputSelected } from '../../common/pipes/validators';
import { SalesService } from '../../sales-ui/services/sales.service';
import {
  STOCK_LEDGER_CSV_FILE,
  STOCK_LEDGER_REPORT_HEADERS,
  WAREHOUSES,
} from '../../constants/app-string';
import { StockLedgerDataSource } from './stock-ledger-datasource';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';
import { StockLedgerService } from '../services/stock-ledger/stock-ledger.service';

@Component({
  selector: 'app-stock-ledger-report',
  templateUrl: './stock-ledger-report.page.html',
  styleUrls: ['./stock-ledger-report.page.scss'],
})
export class StockLedgerReportPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: StockLedgerDataSource;
  displayedColumns = [
    'sr_no',
    'posting_date',
    'item_name',
    'item_code',
    'item_group',
    'voucher_no',
    'voucher_type',
    'brand',
    'warehouse',
    'stock_uom',
    'actual_qty',
    'balance_qty',
    'incoming_rate',
    'outgoing_rate',
    'valuation_rate',
    'balance_value',
  ];
  sortQuery: any = {};
  stockLedgerForm: FormGroup = new FormGroup({
    item_name: new FormControl(),
    warehouse: new FormControl(),
    item_group: new FormControl(),
    item_brand: new FormControl(),
    start_date: new FormControl(),
    end_date: new FormControl(),
    voucher_no: new FormControl(),
    voucher_type: new FormControl(),
  });
  validateInput: any = ValidateInputSelected;
  filteredItemNameList: Observable<any>;
  filteredWarehouseList: Observable<any[]>;
  filteredItemGroupList: Observable<any>;
  filteredItemBrandList: Observable<any>;
  filteredProjectList: Observable<any[]>;
  voucherTypeList = [];

  get f() {
    return this.stockLedgerForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly csvService: CsvJsonService,
    private readonly stockEntryService: StockEntryService,
    private readonly stockLedgerService: StockLedgerService,
  ) {}

  ngOnInit() {
    this.dataSource = new StockLedgerDataSource(this.stockLedgerService);
    this.dataSource.loadItems(0, 30, undefined, undefined);
    this.setAutoComplete();
  }

  setAutoComplete() {
    this.stockEntryService.getVoucherTypeList().subscribe(res => {
      res.forEach((voucherType: string) => {
        this.voucherTypeList.push(voucherType);
      });
      this.voucherTypeList.push('All Vouchers');
    });

    this.filteredItemNameList = this.stockLedgerForm
      .get('item_name')
      .valueChanges.pipe(
        startWith(''),
        distinctUntilChanged(),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getItemList(value);
        }),
      );

    this.filteredWarehouseList = this.stockLedgerForm
      .get('warehouse')
      .valueChanges.pipe(
        startWith(''),
        distinctUntilChanged(),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getStore().getItemAsync(WAREHOUSES, value);
        }),
      );

    this.filteredItemGroupList = this.stockLedgerForm
      .get('item_group')
      .valueChanges.pipe(
        startWith(''),
        distinctUntilChanged(),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getItemGroupList(value);
        }),
      );

    this.filteredItemBrandList = this.stockLedgerForm
      .get('item_brand')
      .valueChanges.pipe(
        startWith(''),
        distinctUntilChanged(),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getItemBrandList(value);
        }),
      );
  }

  navigateBack() {
    this.location.back();
  }

  clearFilters() {
    this.stockLedgerForm.reset();
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.paginator.pageIndex,
      this.paginator.pageSize,
      undefined,
      this.sortQuery,
    );
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.item_name.value)
      query.item_code = this.f.item_name.value.item_code;
    if (this.f.item_brand.value) query.item_brand = this.f.item_brand.value;
    if (this.f.voucher_type.value)
      query.voucher_type = this.f.voucher_type.value;
    if (this.f.item_group.value) query.item_group = this.f.item_group.value;
    if (this.f.voucher_no.value) query.voucher_no = this.f.voucher_no.value;
    if (this.f.warehouse.value) query.warehouse = this.f.warehouse.value;
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
        ? { posting_date: 'DESC' }
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

  getUpdate(event: any) {
    const query: any = {};

    if (this.f.item_name.value) query.item_name = this.f.item_name.value;
    if (this.f.item_brand.value) query.item_brand = this.f.item_brand.value;
    if (this.f.voucher_type.value)
      query.voucher_type = this.f.voucher_type.value;
    if (this.f.item_group.value) query.item_group = this.f.item_group.value;
    if (this.f.voucher_no.value) query.voucher_no = this.f.voucher_no.value;
    if (this.f.warehouse.value) query.warehouse = this.f.warehouse.value;
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

  downloadStockLedgerReport() {
    const result: any = this.serializeStockAvailabilityObject(
      this.dataSource.data,
    );
    this.csvService.downloadAsCSV(
      result,
      STOCK_LEDGER_REPORT_HEADERS,
      `${STOCK_LEDGER_CSV_FILE}`,
    );
  }

  serializeStockAvailabilityObject(data: any) {
    const serializedArray: any = [];
    data.forEach(element => {
      const obj1: any = {
        modified: element.modified,
        item_name: element.item.item_name,
        item_code: element.item.item_code,
        item_group: element.item.item_group ? element.item.item_group : '',
        brand: element.item.brand ? element.item.brand : '',
        voucher: element.voucher_no,
        voucher_type: element.voucher_type,
        stock_uom: element.item.stock_uom ? element.item.stock_uom : '',
        warehouse: element.warehouse,
        actual_qty: element.actual_qty,
        balance_qty: element.balance_qty ? element.balance_qty : 0,
        incoming_rate: element.incoming_rate,
        outgoing_rate: element.outgoing_rate,
        valuation_rate: element.valuation_rate,
        balance_value: element.balance_value ? element.balance_value : 0,
      };
      serializedArray.push(obj1);
    });
    return serializedArray;
  }

  getItemName(option: any) {
    return option ? option.item_name : '';
  }
}
