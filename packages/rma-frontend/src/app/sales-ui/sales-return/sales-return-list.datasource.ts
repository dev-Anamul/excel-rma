import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { map, catchError, finalize } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { SalesReturnService } from '../view-sales-invoice/sales-return/sales-return.service';

export interface ListingData {
  name: string;
  posting_date: string;
  title: string;
  total: number;
  status: string;
  owner: string;
  modified_by: string;
}

export interface ListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}

export class SalesReturnListDataSource extends DataSource<ListingData> {
  data: ListingData[];
  length: number;
  offset: number;

  itemSubject = new BehaviorSubject<ListingData[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);
  totalSubject = new BehaviorSubject<number>(0);
  loading$ = this.loadingSubject.asObservable();

  constructor(private readonly salesReturnService: SalesReturnService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<ListingData[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(pageIndex = 0, pageSize = 30, filters: any[], countFilter: any) {
    this.loadingSubject.next(true);

    this.salesReturnService
      .getSalesReturnList(pageIndex, pageSize, filters, countFilter)
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
        this.calculateTotal(items);
        this.itemSubject.next(items);
      });
  }

  calculateTotal(items: ListingData[]) {
    let total = 0;
    items?.forEach(item => {
      total += item.total;
    });
    this.totalSubject.next(total);
  }
}
