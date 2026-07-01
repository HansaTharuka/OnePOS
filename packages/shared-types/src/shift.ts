import { z } from "zod";

export const CASH_DRAWER_MOVEMENT_TYPES = ["opening", "paid-in", "paid-out", "drop"] as const;
export type CashDrawerMovementType = (typeof CASH_DRAWER_MOVEMENT_TYPES)[number];

export const openShiftDtoSchema = z.object({
  terminalId: z.string().min(1),
  branchId: z.string().default("main"),
  openingFloat: z.number().int().nonnegative(),
});
export type OpenShiftDto = z.infer<typeof openShiftDtoSchema>;

export const closeShiftDtoSchema = z.object({
  closingCountedCash: z.number().int().nonnegative(),
});
export type CloseShiftDto = z.infer<typeof closeShiftDtoSchema>;

export const cashDrawerMovementDtoSchema = z.object({
  type: z.enum(["paid-in", "paid-out", "drop"]),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
  managerPin: z.string().optional(),
});
export type CashDrawerMovementDto = z.infer<typeof cashDrawerMovementDtoSchema>;

export interface ShiftDto {
  id: string;
  shiftNo: string;
  terminalId: string;
  branchId: string;
  cashierId: string;
  openingFloat: number;
  expectedCash?: number;
  closingCountedCash?: number;
  variance?: number;
  status: "open" | "closed";
  createdAt: string;
  closedAt?: string;
}

export interface CashDrawerMovementRecordDto {
  id: string;
  shiftId: string;
  type: CashDrawerMovementType;
  amount: number;
  reason?: string;
  authorizedBy?: string;
  recordedBy: string;
  createdAt: string;
}
