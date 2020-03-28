import {
  Injectable,
  OnModuleInit,
  Inject,
  HttpService,
  BadRequestException,
} from '@nestjs/common';
import * as Agenda from 'agenda';
import { AGENDA_TOKEN } from '../../../system-settings/providers/agenda.provider';
import { switchMap, mergeMap, catchError, retry } from 'rxjs/operators';
import { VALIDATE_AUTH_STRING } from '../../../constants/app-strings';
import { STOCK_ENTRY_API_ENDPOINT } from '../../../constants/routes';
import { DirectService } from '../../../direct/aggregates/direct/direct.service';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { of, throwError, from } from 'rxjs';
import { StockEntry } from '../../stock-entry/stock-entry.entity';
import { StockEntryService } from '../../stock-entry/stock-entry.service';

export const CREATE_STOCK_ENTRY_JOB = 'CREATE_STOCK_ENTRY_JOB';

@Injectable()
export class StockEntryJobService implements OnModuleInit {
  constructor(
    @Inject(AGENDA_TOKEN)
    private readonly agenda: Agenda,
    private readonly tokenService: DirectService,
    private readonly http: HttpService,
    private readonly settingsService: SettingsService,
    private readonly serialNoService: SerialNoService,
    private readonly stockEntryService: StockEntryService,
  ) {}

  async onModuleInit() {
    this.agenda.define(
      CREATE_STOCK_ENTRY_JOB,
      { concurrency: 1 },
      async (job: any, done) => {
        // Please note done callback will work only when concurrency is provided.
        this.createStockEntry(job.attrs.data)
          .toPromise()
          .then(success => {
            return done();
          })
          .catch(err => {
            this.updateStockEntryState(job.attrs.data.payload.uuid, {
              isSynced: false,
              inQueue: false,
            });
            return done(err);
          });
      },
    );
  }

  createStockEntry(job) {
    const payload = job.payload;
    return of({}).pipe(
      mergeMap(object => {
        return this.settingsService.find().pipe(
          switchMap(settings => {
            payload.items.filter(item => {
              if (typeof item.serial_no === 'object') {
                item.serial_no = item.serial_no.join('\n');
              }
              return item;
            });
            return this.http.post(
              settings.authServerURL + STOCK_ENTRY_API_ENDPOINT,
              payload,
              {
                headers: this.settingsService.getAuthorizationHeaders(
                  job.token,
                ),
              },
            );
          }),
        );
      }),
      catchError(err => {
        if (
          (err.response && err.response.status === 403) ||
          (err.response.data &&
            err.response.data.exc.includes(VALIDATE_AUTH_STRING))
        ) {
          return this.tokenService.getUserAccessToken(job.token.email).pipe(
            mergeMap(token => {
              job.token.accessToken = token.accessToken;
              return throwError(new BadRequestException(err));
            }),
          );
        }
        return throwError(err);
      }),
      retry(3),
      switchMap(success => {
        this.updateSerials(payload);
        return of({});
      }),
    );
  }

  updateSerials(payload: StockEntry) {
    this.updateStockEntryState(payload.uuid, {
      isSynced: true,
      inQueue: false,
    });
    from(payload.items)
      .pipe(
        switchMap(item => {
          return from(
            this.serialNoService.updateMany(
              { serial_no: { $in: [...item.serial_no.split('\n')] } },
              { $set: { warehouse: item.t_warehouse } },
            ),
          );
        }),
      )
      .subscribe({
        next: success => {},
        error: err => {},
      });
  }

  updateStockEntryState(
    uuid: string,
    update: { isSynced: boolean; inQueue: boolean },
  ) {
    this.stockEntryService
      .updateOne({ uuid }, { $set: update })
      .then(success => {})
      .catch(error => {});
  }
}