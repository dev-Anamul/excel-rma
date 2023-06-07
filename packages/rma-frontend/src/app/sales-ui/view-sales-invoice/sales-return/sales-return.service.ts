import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { StorageService } from '../../../api/storage/storage.service';
import {
  BEARER_TOKEN_PREFIX,
  AUTHORIZATION,
  ACCESS_TOKEN,
} from '../../../constants/storage';
import { map, switchMap } from 'rxjs/operators';
import { forkJoin, from } from 'rxjs';
import {
  GET_DOCTYPE_COUNT_METHOD,
  RELAY_GET_DELIVERY_NOTE_ENDPOINT,
} from '../../../constants/url-strings';
@Injectable({
  providedIn: 'root',
})
export class SalesReturnService {
  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService,
  ) {}

  getSalesReturnList(
    pageIndex = 0,
    pageSize = 30,
    filters: any[],
    countFilter: any[],
  ) {
    const url = RELAY_GET_DELIVERY_NOTE_ENDPOINT;
    const params = new HttpParams()
      .set('fields', '["*"]')
      .set('filters', JSON.stringify(filters))
      .set('limit_page_length', pageSize.toString())
      .set('limit_start', (pageIndex * pageSize).toString());

    return this.getHeaders().pipe(
      switchMap(headers => {
        return forkJoin({
          data: this.http.get(url, { headers, params }),
          length: this.getDoctypeCount('Delivery Note', countFilter),
        });
      }),
      map((res: any) => {
        return {
          docs: res.data.data,
          length: res.length,
          offset: pageIndex,
        };
      }),
    );
  }

  getSalesReturn(name: string) {
    const url = `${RELAY_GET_DELIVERY_NOTE_ENDPOINT}/${name}`;
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<any>(url, { headers });
      }),
      map(res => res.data),
    );
  }

  getStore() {
    return this.storage;
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

  getDoctypeCount(doctype: string, filters: any[]) {
    const url = GET_DOCTYPE_COUNT_METHOD;
    const params = new HttpParams()
      .set('doctype', doctype)
      .set('filters', JSON.stringify(filters) || '[]')
      .set('fields', '["count( `tab' + doctype + '`.`name`) AS total_count"]');

    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<any>(url, { headers, params });
      }),
      map(res => res.message.values[0][0]),
    );
  }
}
