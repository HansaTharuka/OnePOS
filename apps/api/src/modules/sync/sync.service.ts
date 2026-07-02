import { Injectable, Logger } from '@nestjs/common';
import type { SyncEventDto, SyncPushResultDto } from '@onepos/shared-types';
import type { RequestUser } from '../../common/types/request-user';
import { SalesService } from '../sales/sales.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly salesService: SalesService) {}

  /**
   * Replays a batch of queued offline events, in order, one at a time —
   * deliberately sequential rather than Promise.all so per-product stock
   * ordering stays deterministic and the existing single-sale code path
   * (SalesService.create) is reused unchanged for the actual business logic.
   */
  async pushEvents(
    events: SyncEventDto[],
    cashierId: string,
    requestingUser: RequestUser,
  ): Promise<SyncPushResultDto[]> {
    const results: SyncPushResultDto[] = [];

    for (const event of events) {
      const existing = await this.salesService.findByIdempotencyKey(
        event.payload.idempotencyKey,
      );
      if (existing) {
        results.push({
          clientEventId: event.clientEventId,
          status: 'duplicate',
          saleId: existing._id.toString(),
          orderNo: existing.orderNo,
        });
        continue;
      }

      try {
        const sale = await this.salesService.create(
          event.payload,
          cashierId,
          requestingUser,
          { allowStockForceThrough: true },
        );
        results.push({
          clientEventId: event.clientEventId,
          status: sale.needsManagerReview ? 'flagged' : 'applied',
          saleId: sale._id.toString(),
          orderNo: sale.orderNo,
          reason: sale.reviewReason,
        });
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `Sync replay failed for event ${event.clientEventId}: ${reason}`,
        );
        results.push({
          clientEventId: event.clientEventId,
          status: 'failed',
          reason,
        });
      }
    }

    return results;
  }
}
