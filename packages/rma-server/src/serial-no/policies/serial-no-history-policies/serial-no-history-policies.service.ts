import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SerialNoHistoryService } from '../../entity/serial-no-history/serial-no-history.service';

@Injectable()
export class SerialNoHistoryPoliciesService {
  constructor(
    private readonly serialNoHistoryService: SerialNoHistoryService,
  ) {}

  validateLatestEventWithParent(
    parent_document: string,
    serial_no: string[],
  ): Observable<OverlappingEventInterface[]> {
    return this.serialNoHistoryService
      .asyncAggregate([
        {
          $match: {
            serial_no: {
              $in: [serial_no],
            },
          },
        },
        {
          $group: {
            _id: '$serial_no',
            event: {
              $last: '$$ROOT',
            },
          },
        },
        {
          $project: {
            data: '$event.eventType',
            serial: {
              $cond: [
                { $ne: ['$event.parent_document', parent_document] },
                '$event.serial_no',
                '$$REMOVE',
              ],
            },
          },
        },
        {
          $group: {
            _id: '$data',
            serials: {
              $push: '$serial',
            },
          },
        },
        {
          $redact: {
            $cond: {
              if: { $gt: [{ $size: '$serials' }, 0] },
              then: '$$DESCEND',
              else: '$$PRUNE',
            },
          },
        },
      ])
      .pipe(switchMap(data => (data ? of(data) : of([]))));
  }
}

export interface OverlappingEventInterface {
  _id: string;
  serials: string[];
}
