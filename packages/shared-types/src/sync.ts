import { z } from "zod";
import { createSaleDtoSchema } from "./sale";

/**
 * A single queued offline event, as stored in a terminal's local SQLite
 * outbox and replayed to the server once connectivity returns. `sale.create`
 * is the only event type Phase 4 queues — see docs/05-offline-sync-and-backup.md.
 */
export const syncEventDtoSchema = z.object({
  clientEventId: z.string().min(1),
  type: z.literal("sale.create"),
  payload: createSaleDtoSchema,
});
export type SyncEventDto = z.infer<typeof syncEventDtoSchema>;

export const syncPushRequestDtoSchema = z.object({
  events: z.array(syncEventDtoSchema).min(1),
});
export type SyncPushRequestDto = z.infer<typeof syncPushRequestDtoSchema>;

export const SYNC_EVENT_RESULT_STATUSES = [
  "applied",
  "duplicate",
  "flagged",
] as const;
export type SyncEventResultStatus = (typeof SYNC_EVENT_RESULT_STATUSES)[number];

/**
 * One result per submitted event, in the same order as the request.
 * `flagged` means the sale was applied (stock forced through) but needs
 * manager review because the replayed decrement hit a real stockout.
 */
export interface SyncPushResultDto {
  clientEventId: string;
  status: SyncEventResultStatus;
  saleId?: string;
  orderNo?: string;
  reason?: string;
}

export interface SyncPushResponseDto {
  results: SyncPushResultDto[];
}

export interface SyncPullResponseDto {
  serverTime: string;
}
