import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ACCESS_TOKEN,
  AUTHORIZATION,
  BEARER_TOKEN_PREFIX,
} from '../../constants/storage';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StorageService } from '../../api/storage/storage.service';
import {
  PRINT_DELIVERY_INVOICE_ENDPOINT,
  LIST_WARRANTY_INVOICE_ENDPOINT,
  WARRANTY_CLAIM_GET_ONE_ENDPOINT,
  CUSTOMER_ENDPOINT,
  RESET_WARRANTY_CLAIM_ENDPOINT,
  REMOVE_WARRANTY_CLAIM_ENDPOINT,
} from '../../constants/url-strings';
import { APIResponse } from '../../common/interfaces/sales.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CLOSE } from '../../constants/app-string';
@Injectable({
  providedIn: 'root',
})
export class WarrantyService {
  constructor(
    private http: HttpClient,
    private readonly storage: StorageService,
    private readonly snackbar: MatSnackBar,
  ) {}

  findModels(
    model: string,
    filter = '',
    sortOrder = 'asc',
    pageNumber = 0,
    pageSize = 30,
  ) {
    const url = `api/${model}/v1/list`;
    const params = new HttpParams()
      .set('limit', pageSize.toString())
      .set('offset', (pageNumber * pageSize).toString())
      .set('search', filter)
      .set('sort', sortOrder);

    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get(url, {
          params,
          headers,
        });
      }),
    );
  }
  getWarrantyClaimsList(
    sortOrder,
    pageNumber = 0,
    pageSize = 30,
    query,
    territory,
  ) {
    if (!sortOrder) sortOrder = { createdOn: 'desc' };
    if (!query) query = {};
    try {
      sortOrder = JSON.stringify(sortOrder);
    } catch (error) {
      sortOrder = JSON.stringify({ createdOn: 'desc' });
    }
    const url = LIST_WARRANTY_INVOICE_ENDPOINT;
    const params = new HttpParams()
      .set('limit', pageSize.toString())
      .set('offset', (pageNumber * pageSize).toString())
      .set('sort', sortOrder)
      .set('filter_query', JSON.stringify(query))
      .set('territories', JSON.stringify(territory));

    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<APIResponse>(url, {
          params,
          headers,
        });
      }),
    );
  }

  getWarrantyClaim(uuid: string) {
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get(`${WARRANTY_CLAIM_GET_ONE_ENDPOINT}${uuid}`, {
          headers,
        });
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

  getAddressList() {
    const url = CUSTOMER_ENDPOINT;
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get<any>(url, { headers });
      }),
      map(res => res.data),
    );
  }

  getStorage() {
    return this.storage;
  }

  printDocument(doc, invoice_name) {
    const blob = new Blob([JSON.stringify(doc)], {
      type: 'application/json',
    });
    const uploadData = new FormData();
    uploadData.append('file', blob, 'purchase_receipts');
    return this.http
      .post(PRINT_DELIVERY_INVOICE_ENDPOINT, uploadData, {
        responseType: 'arraybuffer',
      })
      .subscribe({
        next: success => {
          const file = new Blob([success], { type: 'application/pdf' });
          const fileURL = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = fileURL;
          a.target = '_blank';
          a.download = invoice_name + '.pdf';
          document.body.appendChild(a);
          a.click();
        },
        error: err => {
          this.snackbar.open(err?.message || err?.error?.message, CLOSE, {
            duration: 4500,
          });
        },
      });
  }

  resetClaim(uuid: string, serial_no?: string) {
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.post<any>(
          `${RESET_WARRANTY_CLAIM_ENDPOINT}`,
          { uuid, serial_no },
          { headers },
        );
      }),
    );
  }

  removeClaim(uuid: string) {
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.post<any>(
          `${REMOVE_WARRANTY_CLAIM_ENDPOINT}${uuid}`,
          {},
          { headers },
        );
      }),
    );
  }
}
