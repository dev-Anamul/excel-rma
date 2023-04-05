import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { SalesService } from '../sales-ui/services/sales.service';
import { catchError, finalize, map } from 'rxjs/operators';

export interface ListingData {
  uuid: string;
  name: string;
  credit_limits: any[];
  extended_credit_limit: any;
  expiry_date: string;
}

export interface ListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}
export class CreditLimitDataSource extends DataSource<ListingData> {
  data: ListingData[];
  length: number;
  offset: number;

  itemSubject = new BehaviorSubject<ListingData[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  loading$ = this.loadingSubject.asObservable();

  constructor(private readonly salesService: SalesService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<ListingData[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(filter = '', sortOrder = 'asc', pageIndex = 0, pageSize = 30) {
    this.loadingSubject.next(true);
    this.salesService
      .getCustomerList(filter, sortOrder, pageIndex, pageSize)
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

  getData() {
    return this.itemSubject.value;
  }

  update(data) {
    this.itemSubject.next(data);
  }
}
