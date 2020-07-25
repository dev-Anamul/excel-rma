import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { map, catchError, finalize } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { StockEntryService } from './services/stock-entry/stock-entry.service';

export interface ListingData {
  uuid: string;
  supplier: string;
  status: string;
  total: number;
}

export interface ListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}
export class StockEntryListDataSource extends DataSource<ListingData> {
  data: ListingData[];
  length: number;
  offset: number;
  total = new BehaviorSubject<number>(0);

  itemSubject = new BehaviorSubject<ListingData[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  loading$ = this.loadingSubject.asObservable();

  constructor(private StockEntryListService: StockEntryService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<ListingData[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(sortOrder?, pageIndex = 0, pageSize = 10, query?) {
    this.loadingSubject.next(true);
    this.StockEntryListService.getStockEntryList(
      sortOrder,
      pageIndex,
      pageSize,
      query,
    )
      .pipe(
        map((res: ListResponse) => {
          this.data = res.docs;
          this.offset = res.offset;
          this.length = res.length;
          return res.docs;
        }),
        catchError(() => of([])),
        finalize(() => this.loadingSubject.next(false)),
      )
      .subscribe(items => {
        this.itemSubject.next(items);
      });
  }
}

export class StockEntryListData {
  _id: string;
  uuid: string;
  docstatus: number;
  createdOn: string;
  createdByEmail: string;
  createdBy: string;
  stock_entry_type: string;
  company: string;
  posting_date: string;
  posting_time: string;
  doctype: string;
  items: StockEntryListItem[];
}

export class StockEntryListItem {
  s_warehouse: string;
  t_warehouse: string;
  item_code: string;
  item_name: string;
  qty: number;
  transferWarehouse: string;
}
