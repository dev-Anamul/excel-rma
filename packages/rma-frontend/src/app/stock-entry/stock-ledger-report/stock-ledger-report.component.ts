import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable, of } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { ValidateInputSelected } from 'src/app/common/pipes/validators';
import { SalesService } from '../../sales-ui/services/sales.service';
import { STOCK_LEDGER_CSV_FILE, STOCK_LEDGER_REPORT_HEADERS, WAREHOUSES } from '../../constants/app-string';
// import { StockEntryService } from '../services/stock-entry/stock-entry.service';
// import { RELAY_LIST_PROJECT_ENDPOINT } from 'src/app/constants/url-strings';
import { StockLedgerDataSource } from './stock-ledger-datasource';
import { CsvJsonService } from 'src/app/api/csv-json/csv-json.service';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';

@Component({
  selector: 'app-stock-ledger-report',
  templateUrl: './stock-ledger-report.component.html',
  styleUrls: ['./stock-ledger-report.component.scss'],
})
export class StockLedgerReportComponent implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dateSearch:any
  stockLedgerForm: FormGroup
  validateInput: any = ValidateInputSelected;
  filteredStockAvailabilityList: Observable<any>;
  filteredWarehouseList: Observable<any[]>;
  filteredItemGroupList: Observable<any>;
  filteredItemBrandList: Observable<any>;
  filteredProjectList: Observable<any[]>;
  VoucherType= []
  filters: any = [];
  countFilter: any = {};
  dataSource: StockLedgerDataSource;
  // dataSource: StockBalanceSummaryDataSource;

  displayedColumns = [
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

  get f() {
    return this.stockLedgerForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly csvService: CsvJsonService,
    private readonly stockEntryService: StockEntryService,
  ) {}

  ngOnInit() {
    this.createFormGroup();
    this.dateSearch = ''

    this.dataSource = new StockLedgerDataSource(this.salesService);
    this.dataSource.loadItems(0, 30, this.filters, this.countFilter, this.dateSearch,);

    this.stockEntryService.getVoucherTypeList().subscribe(res=>{
      res.forEach(voucher => {
        this.VoucherType.push(voucher)
      });
      this.VoucherType.push("All Vouchers")
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
  }

  navigateBack() {
    this.location.back();
  }

  createFormGroup() {
    this.stockLedgerForm = new FormGroup({
      item_name: new FormControl(),
      warehouse: new FormControl(),
      excel_item_group: new FormControl(),
      excel_item_brand: new FormControl(),
      start_date: new FormControl(),
      end_date: new FormControl(),
      voucher: new FormControl(),
      voucher_type: new FormControl(),
    });
  }

  clearFilters() {
    this.f.item_name.setValue('');
    this.f.warehouse.setValue('');
    this.f.excel_item_brand.setValue('');
    this.f.excel_item_group.setValue('');
    this.f.voucher.setValue('');
    this.f.voucher_type.setValue('');
    this.f.start_date.setValue(null);
    this.f.end_date.setValue(null);
    this.setFilter();
  }

  getStockAvailabilityOption(option) {
    if (option) {
      return option.item_name;
    }
  }


  getItemGroupOption(option) {
    if (option) {
      if (option.item_group_name) {
        return `${option.item_group_name}`;
      }
      return option.item_group_name;
    }
  }

  getItemBrandOption(option) {
    if (option) {
      if (option.brand) {
        return `${option.brand}`;
      }
      return option.brand;
    }
  }

  setFilter(event?) {
    this.filters = [];
    this.countFilter = {};
    this.dateSearch = JSON.stringify({
      start_date: this.stockLedgerForm.controls.start_date.value,
      end_date: this.stockLedgerForm.controls.end_date.value,
    });

    if (this.f.item_name.value) {
      this.filters.push([
        'item_code',
        'like',
        `${this.f.item_name.value.item_code}`,
      ]);
    }

    if (this.f.excel_item_brand.value) {
      this.filters.push([
        'excel_item_brand',
        'like',
        `${this.f.excel_item_brand.value.brand}`,
      ]);
      this.countFilter.excel_item_brand = [
        'like',
        `${this.f.excel_item_brand.value.brand}`,
      ];
    }

    if (this.f.voucher_type.value) {
      if(this.f.voucher_type.value != "All Vouchers"){
        this.filters.push([
          'voucher_type',
          'like',
          `${this.f.voucher_type.value}`,
        ]);
      }
    }

    if (this.f.excel_item_group.value) {
      this.filters.push([
        'excel_item_group',
        'like',
        `${this.f.excel_item_group.value.name}`,
      ]);
      this.countFilter.excel_item_group = [
        'like',
        `${this.f.excel_item_group.value.name}`,
      ];
    }

    if (this.f.voucher.value) {
      this.filters.push(['voucher_no', 'like', `${this.f.voucher.value}`]);
    }

    if (this.f.warehouse.value) {
      this.filters.push(['warehouse', 'like', `${this.f.warehouse.value}`]);
      this.countFilter.warehouse = ['like', `${this.f.warehouse.value}`];
    }

    this.dataSource.loadItems(0, 30, this.filters, this.countFilter, this.dateSearch);

  }
  getUpdate(event) {
    this.dataSource.loadItems(
      event.pageIndex,
      event.pageSize,
      this.filters,
      this.countFilter,
      this.dateSearch,
    );
  }

  downloadServiceInvoices() {
    const result: any = this.serializeStockAvailabilityObject(
      this.dataSource.data,
    );
    this.csvService.downloadStockAvailabilityCSV(
      result,
      STOCK_LEDGER_REPORT_HEADERS,
      `${STOCK_LEDGER_CSV_FILE}`,
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
        element.warehouse &&
        element.modified &&
        element.voucher_no &&
        element.balance_qty &&
        element.balance_value &&
        element.item.stock_uom 
      ) {
        const obj1: any = {
          item_name: element.item.item_name,
          item_code: element.item.item_code,
          item_group: element.item.item_group,
          brand: element.item.brand,
          warehouse: element.warehouse,
          actual_qty: element.actual_qty,
          modified: element.modified,
          voucher: element.voucher_no,
          stock_uom: element.item.stock_uom,
          incoming_rate: element.incoming_rate,
          valuation_rate: element.valuation_rate,
          balance_qty: element.balance_qty,
          balance_value: element.balance_value

        };
        serializedArray.push(obj1);
      }
    });
    return serializedArray;
  }


}
