import { Test, TestingModule } from '@nestjs/testing';
import { WarrantyClaimAggregateService } from './warranty-claim-aggregate.service';
import { WarrantyClaimService } from '../../../warranty-claim/entity/warranty-claim/warranty-claim.service';
import { WarrantyClaimPoliciesService } from '../../policies/warranty-claim-policies/warranty-claim-policies.service';
import { SerialNoAggregateService } from '../../../serial-no/aggregates/serial-no-aggregate/serial-no-aggregate.service';
import { SerialNoService } from '../../../serial-no/entity/serial-no/serial-no.service';

describe('warrantyClaimAggregateService', () => {
  let service: WarrantyClaimAggregateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarrantyClaimAggregateService,
        {
          provide: WarrantyClaimService,
          useValue: {},
        },
        {
          provide: WarrantyClaimPoliciesService,
          useValue: {},
        },
        {
          provide: SerialNoAggregateService,
          useValue: {},
        },
        {
          provide: SerialNoService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<WarrantyClaimAggregateService>(
      WarrantyClaimAggregateService,
    );
  });
  WarrantyClaimAggregateService;
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});