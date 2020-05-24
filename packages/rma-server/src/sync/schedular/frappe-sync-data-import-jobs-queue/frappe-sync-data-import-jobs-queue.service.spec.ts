import { Test, TestingModule } from '@nestjs/testing';
import { AGENDA_TOKEN } from '../../../system-settings/providers/agenda.provider';
import { FrappeSyncDataImportJobService } from './frappe-sync-data-import-jobs-queue.service';
import { DeliveryNoteJobService } from '../../../delivery-note/schedular/delivery-note-job/delivery-note-job.service';

describe('FrappeSyncDataImportJobService', () => {
  let service: FrappeSyncDataImportJobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrappeSyncDataImportJobService,
        { provide: AGENDA_TOKEN, useValue: {} },
        {
          provide: DeliveryNoteJobService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<FrappeSyncDataImportJobService>(
      FrappeSyncDataImportJobService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});