import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { StorageService } from '../../api/storage/storage.service';
import {
  JOB_QUEUE_LIST_ENDPOINT,
  JOB_QUEUE_RETRY_ENDPOINT,
  JOB_QUEUE_RESET_ENDPOINT,
} from '../../constants/url-strings';
import { switchMap, map } from 'rxjs/operators';
import {
  AUTHORIZATION,
  BEARER_TOKEN_PREFIX,
  ACCESS_TOKEN,
} from '../../constants/storage';
import { from } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class JobsService {
  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService,
  ) {}

  getJobsList(sortOrder, pageNumber = 0, pageSize = 10, query?) {
    if (!sortOrder) sortOrder = { _id: -1 };
    if (query && query['data.status'] === 'Failed') {
      sortOrder = { failedAt: -1 };
    }

    try {
      sortOrder = JSON.stringify(sortOrder);
    } catch (error) {
      sortOrder = JSON.stringify({ created_on: 'desc' });
    }

    const url = JOB_QUEUE_LIST_ENDPOINT;
    const params = new HttpParams()
      .set('limit', pageSize.toString())
      .set('offset', (pageNumber * pageSize).toString())
      .set('sort', sortOrder)
      .set('filter_query', JSON.stringify(query));

    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.get(url, {
          params,
          headers,
        });
      }),
    );
  }

  retryJob(jobId) {
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.post(
          JOB_QUEUE_RETRY_ENDPOINT,
          { jobId },
          {
            headers,
          },
        );
      }),
    );
  }

  resetJob(jobId) {
    return this.getHeaders().pipe(
      switchMap(headers => {
        return this.http.post(
          JOB_QUEUE_RESET_ENDPOINT,
          { jobId },
          {
            headers,
          },
        );
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

  getStore() {
    return this.storage;
  }
}