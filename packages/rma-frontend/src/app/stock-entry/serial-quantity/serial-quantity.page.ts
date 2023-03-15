import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { FormControl, FormGroup } from '@angular/forms';

import { SerialQuantityDataSource } from './serial-quantity-datasource';
import { SalesService } from '../../sales-ui/services/sales.service';
import { ValidateInputSelected } from '../../common/pipes/validators';
import { ActivatedRoute } from '@angular/router';
import { CsvJsonService } from '../../api/csv-json/csv-json.service';
import {
  SERIAL_QUANTITY_CSV_FILE,
  SERIAL_QUANTITY_DOWNLOAD_HEADERS,
  WAREHOUSES,
} from '../../constants/app-string';
import { MatSort } from '@angular/material/sort';
import { Observable } from 'rxjs';
import { debounceTime, startWith, switchMap } from 'rxjs/operators';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';
@Component({
  selector: 'app-serial-quantity',
  templateUrl: './serial-quantity.page.html',
  styleUrls: ['./serial-quantity.page.scss'],
})
export class SerialQuantityPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: SerialQuantityDataSource;
  displayedColumns = [
    'sr_no',
    'item_name',
    'item_code',
    'warehouse',
    'serial_quantity',
  ];
  sortQuery: any = {};
  serialQuantityForm: FormGroup = new FormGroup({
    item_name: new FormControl(),
    warehouse: new FormControl(),
  });
  validateInput: any = ValidateInputSelected;
  filteredItemNameList: Observable<any[]>;
  filteredWarehouseList: Observable<any[]>;

  get f() {
    return this.serialQuantityForm.controls;
  }

  constructor(
    private readonly location: Location,
    private readonly salesService: SalesService,
    private readonly route: ActivatedRoute,
    private readonly csvService: CsvJsonService,
    private readonly stockEntryService: StockEntryService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new SerialQuantityDataSource(this.stockEntryService);
    this.dataSource.loadItems(0, 30, undefined, undefined);
    this.setAutoComplete();
  }

  setAutoComplete() {
    this.filteredItemNameList = this.serialQuantityForm
      .get('item_name')
      .valueChanges.pipe(
        startWith(''),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getItemList(value);
        }),
      );

    this.filteredWarehouseList = this.serialQuantityForm
      .get('warehouse')
      .valueChanges.pipe(
        startWith(''),
        debounceTime(1000),
        switchMap(value => {
          return this.salesService.getStore().getItemAsync(WAREHOUSES, value);
        }),
      );
  }

  clearFilters() {
    this.serialQuantityForm.reset();
    this.setFilter();
  }

  setFilter(event?: any) {
    const query: any = {};
    if (this.f.item_name.value) query.item_name = this.f.item_name.value;
    if (this.f.warehouse.value) query.warehouse = this.f.warehouse.value;
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
        ? { item_name: 'ASC' }
        : this.sortQuery;

    this.dataSource.loadItems(0, 30, query, this.sortQuery);
  }

  navigateBack() {
    this.location.back();
  }

  getItemGroupOption(option) {
    if (option) {
      if (option.item_group_name) {
        return `${option.item_group_name}`;
      }
      return option.item_group_name;
    }
  }

  downloadSerialQuantity() {
    const result: any = this.serializeSerialQuantityObject(
      this.dataSource.data,
    );
    this.csvService.downloadAsCSV(
      result,
      SERIAL_QUANTITY_DOWNLOAD_HEADERS,
      `${SERIAL_QUANTITY_CSV_FILE}`,
    );
  }

  serializeSerialQuantityObject(data: any) {
    const serializedArray: any = [];
    data.forEach((element: any) => {
      if (
        element.item_name &&
        element.item_code &&
        element.warehouse &&
        element.total
      ) {
        const obj1: any = {
          item_name: element.item_name,
          item_code: element.item_code,
          warehouse: element.warehouse,
          total: element.total,
        };
        serializedArray.push(obj1);
      }
    });
    return serializedArray;
  }
}
