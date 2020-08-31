import {
  Injectable,
  NotFoundException,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import * as uuidv4 from 'uuid/v4';
import { WarrantyClaim } from '../../entity/warranty-claim/warranty-claim.entity';
import { WarrantyClaimService } from '../../entity/warranty-claim/warranty-claim.service';
import { WarrantyClaimRemovedEvent } from '../../event/warranty-claim-removed/warranty-claim-removed.event';
import { WarrantyClaimUpdatedEvent } from '../../event/warranty-claim-updated/warranty-claim-updated.event';
import { UpdateWarrantyClaimDto } from '../../entity/warranty-claim/update-warranty-claim-dto';
import { from, throwError, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  INVALID_FILE,
  VERDICT,
  CLAIM_STATUS,
} from '../../../constants/app-strings';
import {
  BulkWarrantyClaimInterface,
  BulkWarrantyClaim,
} from '../../entity/warranty-claim/create-bulk-warranty-claim.interface';
import { WarrantyClaimPoliciesService } from '../../policies/warranty-claim-policies/warranty-claim-policies.service';
import { SerialNoAggregateService } from '../../../serial-no/aggregates/serial-no-aggregate/serial-no-aggregate.service';
import { SerialNoDto } from '../../../serial-no/entity/serial-no/serial-no-dto';
import { BulkWarrantyClaimsCreatedEvent } from '../../event/bulk-warranty-claims-created/bulk-warranty-claims.event';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';
import { WARRANTY_TYPE, DELIVERY_STATUS } from '../../../constants/app-strings';
import { DateTime } from 'luxon';
import { SettingsService } from '../../../system-settings/aggregates/settings/settings.service';
import { CLAIM_TYPE_INVLAID } from '../../../constants/messages';
import { WarrantyClaimDto } from '../../../warranty-claim/entity/warranty-claim/warranty-claim-dto';
import { StatusHistoryDto } from '../../entity/warranty-claim/status-history-dto';
@Injectable()
export class WarrantyClaimAggregateService extends AggregateRoot {
  constructor(
    private readonly warrantyClaimService: WarrantyClaimService,
    private readonly warrantyClaimsPoliciesService: WarrantyClaimPoliciesService,
    private readonly serialNoAggregateService: SerialNoAggregateService,
    private readonly serialNoService: SerialNoService,
    private readonly settingsService: SettingsService,
  ) {
    super();
  }
  addWarrantyClaim(warrantyClaimPayload: WarrantyClaimDto, clientHttpRequest) {
    warrantyClaimPayload.status_history = [];
    warrantyClaimPayload.status_history.push({
      status: clientHttpRequest.token.fullName,
      posting_date: warrantyClaimPayload.received_on,
      time: warrantyClaimPayload.posting_time,
      verdict: VERDICT.RECEIVED_FROM_CUSTOMER,
      status_from: warrantyClaimPayload.receiving_branch,
      transfer_branch: '',
      description: '',
      delivery_status: '',
      created_by_email: clientHttpRequest.token.email,
      created_by: clientHttpRequest.token.fullName,
    });
    switch (warrantyClaimPayload.claim_type) {
      case WARRANTY_TYPE.WARRANTY:
        return this.createWarrantyNonWarrantyClaim(
          warrantyClaimPayload,
          clientHttpRequest,
        );

      case WARRANTY_TYPE.NON_WARRANTY:
        return this.createWarrantyNonWarrantyClaim(
          warrantyClaimPayload,
          clientHttpRequest,
        );

      case WARRANTY_TYPE.NON_SERAIL:
        return this.createNonSerialClaim(
          warrantyClaimPayload,
          clientHttpRequest,
        );

      case WARRANTY_TYPE.THIRD_PARTY:
        return this.createThirdPartyClaim(
          warrantyClaimPayload,
          clientHttpRequest,
        );

      default:
        return throwError(new NotImplementedException(CLAIM_TYPE_INVLAID));
    }
  }

  assignFields(warrantyClaimPayload: WarrantyClaimDto, clientHttpRequest) {
    return this.settingsService.find().pipe(
      switchMap(settings => {
        if (!settings) {
          return throwError(new NotImplementedException());
        }
        const warrantyClaim = new WarrantyClaim();
        Object.assign(warrantyClaim, warrantyClaimPayload);
        warrantyClaim.uuid = uuidv4();
        warrantyClaim.received_by = clientHttpRequest.token.fullName;
        warrantyClaim.claim_status = CLAIM_STATUS.IN_PROGRESS;
        warrantyClaim.createdOn = new DateTime(settings.timeZone).toJSDate();
        return of(warrantyClaim);
      }),
    );
  }

  createWarrantyNonWarrantyClaim(
    claimsPayload: WarrantyClaimDto,
    clientHttpRequest,
  ) {
    return this.warrantyClaimsPoliciesService
      .validateWarrantyCustomer(claimsPayload.customer)
      .pipe(
        switchMap(() => {
          return this.warrantyClaimsPoliciesService.validateWarrantySerailNo(
            claimsPayload,
          );
        }),
        switchMap((payload: WarrantyClaimDto) => {
          return this.assignFields(payload, clientHttpRequest);
        }),
        switchMap((warrantyClaimPayload: WarrantyClaim) => {
          return from(this.warrantyClaimService.create(warrantyClaimPayload));
        }),
      );
  }

  createNonSerialClaim(claimsPayload: WarrantyClaimDto, clientHttpRequest) {
    return this.warrantyClaimsPoliciesService
      .validateWarrantyCustomer(claimsPayload.customer)
      .pipe(
        switchMap(() => {
          return this.assignFields(claimsPayload, clientHttpRequest);
        }),
        switchMap((warrantyClaimPayload: WarrantyClaim) => {
          return from(this.warrantyClaimService.create(warrantyClaimPayload));
        }),
      );
  }

  createThirdPartyClaim(claimsPayload: WarrantyClaimDto, clientHttpRequest) {
    return this.assignFields(claimsPayload, clientHttpRequest).pipe(
      switchMap(warrantyClaimPayload => {
        return from(this.warrantyClaimService.create(warrantyClaimPayload));
      }),
    );
  }

  async retrieveWarrantyClaim(uuid: string, req) {
    const provider = await this.warrantyClaimService.findOne({ uuid });
    if (!provider) throw new NotFoundException();
    return provider;
  }

  async getWarrantyClaimList(
    offset,
    limit,
    sort,
    filter_query?,
    territory?,
    req?,
  ) {
    return await this.warrantyClaimService.list(
      offset,
      limit,
      sort,
      filter_query,
      territory,
      req,
    );
  }

  async remove(uuid: string) {
    const found = await this.warrantyClaimService.findOne({ uuid });
    if (!found) {
      throw new NotFoundException();
    }
    this.apply(new WarrantyClaimRemovedEvent(found));
  }

  async update(updatePayload: UpdateWarrantyClaimDto) {
    const provider = await this.warrantyClaimService.findOne({
      uuid: updatePayload.uuid,
    });
    if (!provider) {
      throw new NotFoundException();
    }
    const update = Object.assign(provider, updatePayload);
    update.modifiedOn = new Date();
    this.apply(new WarrantyClaimUpdatedEvent(update));
  }

  addBulkClaims(claimsPayload: File, clientHttpRequest) {
    return from(this.getJsonData(claimsPayload)).pipe(
      switchMap((data: BulkWarrantyClaimInterface) => {
        if (!data || !data.claims) {
          return throwError(new BadRequestException(INVALID_FILE));
        }
        return this.warrantyClaimsPoliciesService
          .validateBulkWarrantyClaim(data)
          .pipe(
            switchMap(validData => {
              this.createBulkSerials(data.claims, clientHttpRequest);
              const mappedWarranty = this.mapWarrantyClaims(data.claims);
              this.apply(new BulkWarrantyClaimsCreatedEvent(mappedWarranty));
              return of({});
            }),
          );
      }),
    );
  }

  getJsonData(file) {
    return of(JSON.parse(file.buffer));
  }

  createBulkSerials(claims: BulkWarrantyClaim[], clientHttpRequest) {
    claims.forEach(claim => {
      const serialNo: SerialNoDto = {
        supplier: claim.supplier,
        serial_no: claim.serial_no,
        claim_no: claim.claim_no,
        claim_type: claim.claim_type,
        customer_third_party: claim.customer_third_party,
        item_code: claim.item_code,
        claimed_serial: claim.claimed_serial,
        invoice_no: claim.invoice_no,
        service_charge: claim.service_charge,
        claim_status: claim.claim_status,
        warranty_status: claim.warranty_status,
        receiving_branch: claim.receiving_branch,
        delivery_branch: claim.delivery_branch,
        received_by: claim.received_by,
        delivered_by: claim.delivered_by,
        received_date: new Date(),
        deliver_date: new Date(),
        brand: claim.brand,
      };
      return this.serialNoAggregateService
        .validateNewSerialNo(serialNo, clientHttpRequest)
        .pipe(
          switchMap(validSerialNo => {
            return from(this.serialNoService.create(validSerialNo));
          }),
        )
        .subscribe({
          next: success => {},
          error: err => {},
        });
    });
  }

  mapWarrantyClaims(claims: BulkWarrantyClaim[]) {
    const mappedClaims = [];
    claims.forEach(claim => {
      const warrantyClaim = new WarrantyClaim();
      warrantyClaim.serialNo = claim.serial_no;
      warrantyClaim.claim_no = claim.claim_no;
      warrantyClaim.claim_type = claim.claim_type;
      warrantyClaim.customer_third_party = claim.customer_third_party;
      warrantyClaim.item_code = claim.item_code;
      warrantyClaim.claimed_serial = claim.claimed_serial;
      warrantyClaim.invoice_no = claim.invoice_no;
      warrantyClaim.service_charge = claim.service_charge;
      warrantyClaim.claim_status = claim.claim_status;
      warrantyClaim.warranty_status = claim.warranty_status;
      warrantyClaim.receiving_branch = claim.receiving_branch;
      warrantyClaim.delivery_branch = claim.delivery_branch;
      warrantyClaim.received_by = claim.received_by;
      warrantyClaim.delivered_by = claim.delivered_by;
      warrantyClaim.received_date = new Date();
      warrantyClaim.deliver_date = new Date();
      warrantyClaim.uuid = uuidv4();
      mappedClaims.push(warrantyClaim);
    });
    return mappedClaims;
  }

  addStatusHistory(statusHistoryPayload: StatusHistoryDto, clientHttpRequest) {
    const statusHistoryDetails = this.mapStatusHistory(
      statusHistoryPayload,
      clientHttpRequest,
    );
    return from(
      this.warrantyClaimService.updateOne(
        { uuid: statusHistoryPayload.uuid },
        {
          $push: {
            status_history: statusHistoryDetails,
          },
        },
      ),
    ).pipe(
      switchMap(history => {
        return this.setClaimStatus(statusHistoryPayload);
      }),
      switchMap(state => {
        return this.warrantyClaimService.updateOne(
          {
            uuid: statusHistoryPayload.uuid,
          },
          {
            $set: {
              claim_status: state,
            },
          },
        );
      }),
      switchMap(() => {
        if (!statusHistoryPayload.delivery_status) {
          return of({});
        }
        return from(
          this.warrantyClaimService.updateOne(
            { uuid: statusHistoryPayload.uuid },
            {
              $set: {
                delivery_date: statusHistoryPayload.date,
                delivery_branch: statusHistoryPayload.delivery_branch,
                delivered_by: clientHttpRequest.token.fullName,
              },
            },
          ),
        );
      }),
    );
  }

  mapStatusHistory(statusHistoryPayload: StatusHistoryDto, clientHttpRequest) {
    const statusHistory: any = {};
    Object.assign(statusHistory, statusHistoryPayload);
    statusHistory.status = clientHttpRequest.token.fullName;
    statusHistory.created = clientHttpRequest.token.fullName;
    statusHistory.created_by_email = clientHttpRequest.token.email;
    return statusHistory;
  }

  removeStatusHistory(uuid) {
    return from(
      this.warrantyClaimService.updateOne(uuid, {
        $set: {
          delivery_branch: '',
          delivery_date: '',
        },
        $pop: {
          status_history: 1,
        },
      }),
    );
  }

  setClaimStatus(statusHistoryPayload: StatusHistoryDto) {
    let status = '';
    switch (statusHistoryPayload.verdict) {
      case VERDICT.RECEIVED_FROM_CUSTOMER:
        status = CLAIM_STATUS.IN_PROGRESS;
        break;
      case VERDICT.RECEIVED_FROM_BRANCH:
        status = CLAIM_STATUS.IN_PROGRESS;
        break;
      case VERDICT.WORK_IN_PROGRESS:
        status = CLAIM_STATUS.IN_PROGRESS;
        break;
      case VERDICT.TRANSFERRED:
        status = CLAIM_STATUS.IN_PROGRESS;
        break;
      case VERDICT.SOLVED:
        status = CLAIM_STATUS.TO_DELIVER;
        break;
      case VERDICT.UNSOLVED:
        status = CLAIM_STATUS.UNSOLVED;
        break;
      case VERDICT.TO_REPLACE:
        status = CLAIM_STATUS.TO_DELIVER;
        break;
      case VERDICT.DELIVER_TO_CUSTOMER:
        this.checkDeliveryStatus(
          statusHistoryPayload.delivery_status,
        ).subscribe({
          next: claim_status => {
            status = claim_status;
          },
        });
        break;
      default:
        break;
    }
    return of(status);
  }

  checkDeliveryStatus(delivery_status: string) {
    switch (delivery_status) {
      case DELIVERY_STATUS.REPAIRED:
        delivery_status = CLAIM_STATUS.DELIVERED;
        break;
      case DELIVERY_STATUS.REPLACED:
        delivery_status = CLAIM_STATUS.DELIVERED;
        break;
      case DELIVERY_STATUS.UPGRADED:
        delivery_status = CLAIM_STATUS.DELIVERED;
        break;
      case DELIVERY_STATUS.REJECTED:
        delivery_status = CLAIM_STATUS.UNSOLVED;
        break;
      default:
        break;
    }
    return of(delivery_status);
  }
}
