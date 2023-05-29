import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { StockLedgerService } from '../services/stock-ledger/stock-ledger.service';

export interface ListingData {
  actual_qty: number;
  item_code: string;
  name: string;
  ordered_qty: number;
  projected_qty: number;
  stock_value: number;
  warehouse: string;
}

export interface ListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}
export class StockAvailabilityDataSource extends DataSource<ListingData> {
  data: ListingData[];
  length: number;
  offset: number;

  itemSubject = new BehaviorSubject<ListingData[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  loading$ = this.loadingSubject.asObservable();

  constructor(private readonly stockLedgerService: StockLedgerService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<ListingData[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(pageIndex = 0, pageSize = 30, filters?: any, sortOrder?: any) {
    this.loadingSubject.next(true);
    this.stockLedgerService
      .listStockLedger(pageIndex, pageSize, filters, sortOrder)
      .pipe(
        map((res: ListResponse) => {
          this.data = res.docs;
          this.length = res.length[0].total;
          this.offset = res.offset;
          return res.docs;
        }),
        catchError(() => of([])),
        finalize(() => this.loadingSubject.next(false)),
      )
      .subscribe(items => this.itemSubject.next(items));
  }

  getData() {
    return this.itemSubject.value;
  }

  update(data) {
    this.itemSubject.next(data);
  }
}
