import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { StockEntryService } from '../services/stock-entry/stock-entry.service';

export interface ListingData {
  item_name: string;
  item_code: string;
  warehouse: number;
  total: number;
}

export interface ListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}

export class SerialQuantityDataSource extends DataSource<ListingData> {
  data: ListingData[];
  length: number;
  offset: number;

  itemSubject = new BehaviorSubject<ListingData[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  loading$ = this.loadingSubject.asObservable();

  constructor(private readonly stockEntryService: StockEntryService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<ListingData[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(pageIndex = 0, pageSize = 30, filters: any, sortOrder: any) {
    if (!sortOrder) {
      sortOrder = { item_name: 'asc' };
    }
    this.loadingSubject.next(true);
    this.stockEntryService
      .listSerialQuantity(pageIndex, pageSize, filters, sortOrder)
      .pipe(
        map((res: ListResponse) => {
          this.data = res.docs;
          this.length = res.length;
          this.offset = res.offset;
          return res.docs;
        }),
        catchError(() => of([])),
        finalize(() => this.loadingSubject.next(false)),
      )
      .subscribe(items => this.itemSubject.next(items));
  }
}
