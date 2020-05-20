import {
  Injectable,
  OnModuleInit,
  HttpService,
  Logger,
  Inject,
} from '@nestjs/common';
import * as Agenda from 'agenda';
import { from } from 'rxjs';
import { map, retryWhen, delay, take, mergeMap } from 'rxjs/operators';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { CustomerService } from '../../entity/customer/customer.service';
import { ClientTokenManagerService } from '../../../auth/aggregates/client-token-manager/client-token-manager.service';
import {
  FRAPPE_API_GET_CUSTOMER_ENDPOINT,
  ERPNEXT_CUSTOMER_CREDIT_LIMIT_ENDPOINT,
} from '../../../constants/routes';
import {
  CONTENT_TYPE,
  APPLICATION_JSON_CONTENT_TYPE,
  ACCEPT,
} from '../../../constants/app-strings';
import {
  RESET_CREDIT_LIMIT_SUCCESS,
  RESET_CREDIT_LIMIT_ERROR,
} from '../../../constants/messages';
import { AGENDA_TOKEN } from '../../../system-settings/providers/agenda.provider';

export const RESET_CUSTOMER_CREDIT_LIMIT = 'RESET_CUSTOMER_CREDIT_LIMIT';
@Injectable()
export class ResetCreditLimitService implements OnModuleInit {
  constructor(
    @Inject(AGENDA_TOKEN)
    private readonly agenda: Agenda,
    private readonly settings: SettingsService,
    private readonly customer: CustomerService,
    private readonly clientToken: ClientTokenManagerService,
    private readonly http: HttpService,
  ) {}

  onModuleInit() {
    // Run every hour
    this.agenda.define(
      RESET_CUSTOMER_CREDIT_LIMIT,
      { concurrency: 1 },
      async (job, done) => {
        const now = new Date();
        const customers = await this.customer.find({
          baseCreditLimitAmount: { $exists: true },
          tempCreditLimitPeriod: { $lte: now },
        });

        from(customers)
          .pipe(
            mergeMap(customer => {
              this.customer
                .updateOne(
                  { uuid: customer.uuid },
                  { $unset: { tempCreditLimitPeriod: '' } },
                )
                .then(success => {})
                .catch(error => {});
              return this.settings.find().pipe(
                mergeMap(settings => {
                  return this.clientToken.getServiceAccountApiHeaders().pipe(
                    mergeMap(headers => {
                      headers[CONTENT_TYPE] = APPLICATION_JSON_CONTENT_TYPE;
                      headers[ACCEPT] = APPLICATION_JSON_CONTENT_TYPE;
                      return this.http
                        .get(
                          settings.authServerURL +
                            FRAPPE_API_GET_CUSTOMER_ENDPOINT +
                            '/' +
                            customer.name,
                          { headers },
                        )
                        .pipe(
                          map(res => res.data),
                          mergeMap(erpnextCustomer => {
                            const creditLimits: any[] =
                              erpnextCustomer.credit_limits || [];

                            for (const limit of creditLimits) {
                              if (limit.company === settings.defaultCompany) {
                                return this.http.put(
                                  settings.authServerURL +
                                    ERPNEXT_CUSTOMER_CREDIT_LIMIT_ENDPOINT +
                                    '/' +
                                    limit.name,
                                  {
                                    credit_limit:
                                      customer.baseCreditLimitAmount,
                                  },
                                  { headers },
                                );
                              }
                            }

                            creditLimits.push({
                              credit_limit: customer.baseCreditLimitAmount,
                              company: settings.defaultCompany,
                            });
                            return this.http.put(
                              settings.authServerURL +
                                FRAPPE_API_GET_CUSTOMER_ENDPOINT +
                                '/' +
                                customer.name,
                              { credit_limits: creditLimits },
                              { headers },
                            );
                          }),
                        );
                    }),
                  );
                }),
              );
            }),
            retryWhen(error => error.pipe(delay(1000), take(3))),
          )
          .toPromise()
          .then(success => {
            Logger.log(RESET_CREDIT_LIMIT_SUCCESS, this.constructor.name);
            done();
          })
          .catch(error => {
            Logger.error(RESET_CREDIT_LIMIT_ERROR, this.constructor.name);
            done(this.getPureError(error));
          });
      },
    );

    this.agenda
      .every('60 minutes', RESET_CUSTOMER_CREDIT_LIMIT)
      .then(scheduled => {})
      .catch(error => {});
  }

  getPureError(error) {
    if (error && error.response) {
      error = error.response.data ? error.response.data : error.response;
    }
    try {
      return JSON.parse(JSON.stringify(error, this.replaceErrors));
    } catch {
      return error.data ? error.data : error;
    }
  }

  replaceErrors(keys, value) {
    if (value instanceof Error) {
      const error = {};

      Object.getOwnPropertyNames(value).forEach(key => {
        error[key] = value[key];
      });

      return error;
    }

    return value;
  }
}
