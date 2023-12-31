import { DataSource, CollectionViewer } from '@angular/cdk/collections';
import { map, catchError, finalize } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ServiceInvoiceDetails } from '../warranty-ui/shared-warranty-modules/service-invoices/add-service-invoice/service-invoice-interface';
import { ServiceInvoiceService } from '../warranty-ui/shared-warranty-modules/service-invoices/service-invoice.service';

export interface ListResponse {
  docs: ServiceInvoiceDetails[];
  length: number;
  offset: number;
}
export class ServiceInvoicesDataSource extends DataSource<ServiceInvoiceDetails> {
  data: ServiceInvoiceDetails[];
  length: number;
  offset: number;

  total = new BehaviorSubject<number>(0);

  itemSubject = new BehaviorSubject<ServiceInvoiceDetails[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  loading$ = this.loadingSubject.asObservable();

  constructor(private readonly serviceInvoice: ServiceInvoiceService) {
    super();
  }

  connect(
    collectionViewer: CollectionViewer,
  ): Observable<ServiceInvoiceDetails[]> {
    return this.itemSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.itemSubject.complete();
    this.loadingSubject.complete();
  }

  loadItems(pageIndex = 0, pageSize = 30, filter: any = {}, sortOrder?: any) {
    this.loadingSubject.next(true);
    try {
      filter = JSON.stringify(filter);
    } catch {
      filter = {};
    }
    this.serviceInvoice
      .getServiceInvoiceList(filter as string, sortOrder, pageIndex, pageSize)
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
        this.calculateTotal(items);
      });
  }

  calculateTotal(serviceInvoice: ServiceInvoiceDetails[]) {
    let sum = 0;
    (serviceInvoice ? serviceInvoice : []).forEach(item => {
      sum += item.total;
    });
    this.total.next(sum);
  }
}
