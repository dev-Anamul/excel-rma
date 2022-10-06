import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { SalesService } from '../../sales-ui/services/sales.service';

export interface ListingData {
  item_code: string;
  item_name: string;
  item_group: string;
  warehouse: string;
  item_brand: string;
  actual_qty: number;
  stock_uom: string;
  transferin_id: string;
  voucher_no: string;
  balance_qty: number;
  incoming_rate: number;
  outgoing_rate: number;
  valuation_rate: number;
  balance_value: number;
}

export interface ItemListResponse {
  docs: ListingData[];
  length: number;
  offset: number;
}
export class StockLedgerDataSource extends DataSource<ListingData> {
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

  loadItems(pageIndex = 0, pageSize = 30, filters = [], countFilter = [], dateSearch='') {
    this.loadingSubject.next(true);
    this.salesService
      .getStockLedger(pageIndex, pageSize, filters, dateSearch)
      .pipe(
        map((items: ListingData[]) => {
          this.data = items;
          items.forEach(item => {
            if(item.transferin_id){
              item.voucher_no = item.transferin_id;
            }
          })
          return items;
        }),
        catchError(() => of([])),
        finalize(() => this.loadingSubject.next(false)),
      )
      .subscribe(items => this.itemSubject.next(items));

    this.salesService.getLedgerCount(pageIndex, pageSize, filters, dateSearch).subscribe({
      next: res => {
        if (res) {
          res.forEach(element => {
            this.length = element.count;
          });
        } else {
          this.length = 0;
        }
      },
    });
  }

  getData() {
    return this.itemSubject.value;
  }

  update(data) {
    this.itemSubject.next(data);
  }
}
