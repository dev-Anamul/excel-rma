import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StorageService } from '../../../api/storage/storage.service';
import {
  ACCESS_TOKEN,
  AUTHORIZATION,
  BEARER_TOKEN_PREFIX,
} from '../../../constants/storage';
import {
  LIST_LEDGER_REPORT_ENDPOINT,
  LIST_STOCK_LEDGER_ENDPOINT,
} from '../../../constants/url-strings';

@Injectable({
  providedIn: 'root',
})
export class StockLedgerService {
  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService,
  ) {}

  listLedgerReport(
    pageIndex: number = 0,
    pageSize: number = 30,
    filter: any,
    sortOrder: any,
  ) {
    const params = new HttpParams()
      .set('limit', pageSize.toString())
      .set('offset', (pageIndex * pageSize).toString())
      .set('query', JSON.stringify(filter))
      .set('sort', sortOrder);

    const url = LIST_LEDGER_REPORT_ENDPOINT;
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<any>(url, { headers, params });
      }),
    );
  }

  listStockLedger(
    pageIndex: number,
    pageSize: number,
    filters: any,
    sortOrder: any,
  ) {
    const url = LIST_STOCK_LEDGER_ENDPOINT;
    const params = new HttpParams()
      .set('limit', pageSize.toString())
      .set('offset', (pageIndex * pageSize).toString())
      .set('query', JSON.stringify(filters))
      .set('sort', sortOrder);

    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<any>(url, { headers, params });
      }),
    );
  }

  getHeaders() {
    return from(this.storage.getItem(ACCESS_TOKEN)).pipe(
      map(token => {
        return {
          [AUTHORIZATION]: BEARER_TOKEN_PREFIX + token,
        };
      }),
    );
  }
}
