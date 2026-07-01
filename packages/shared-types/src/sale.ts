import { z } from "zod";

export const createSaleLineDtoSchema = z.object({
  productId: z.string(),
  uom: z.string().min(1),
  qty: z.number().positive(),
  discount: z.number().int().nonnegative().default(0),
});
export type CreateSaleLineDto = z.infer<typeof createSaleLineDtoSchema>;

export const PAYMENT_METHODS = ["cash", "card", "mobile", "credit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentLineDtoSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().positive(),
  reference: z.string().optional(),
});
export type PaymentLineDto = z.infer<typeof paymentLineDtoSchema>;

export const createSaleDtoSchema = z.object({
  idempotencyKey: z.string().min(1),
  terminalId: z.string().min(1),
  branchId: z.string().default("main"),
  customerId: z.string().optional(),
  shiftId: z.string().min(1),
  lines: z.array(createSaleLineDtoSchema).min(1),
  payments: z.array(paymentLineDtoSchema).min(1),
  managerOverridePin: z.string().optional(),
  resumedFromParkedId: z.string().optional(),
});
export type CreateSaleDto = z.infer<typeof createSaleDtoSchema>;

export const parkSaleDtoSchema = z.object({
  terminalId: z.string().min(1),
  shiftId: z.string().min(1),
  customerId: z.string().optional(),
  lines: z.array(createSaleLineDtoSchema).min(1),
});
export type ParkSaleDto = z.infer<typeof parkSaleDtoSchema>;

export const voidSaleDtoSchema = z.object({
  managerPin: z.string().min(1),
  reason: z.string().min(1),
});
export type VoidSaleDto = z.infer<typeof voidSaleDtoSchema>;

/** Persisted line — snapshots price/tax/uom at time of sale, never re-derived later. */
export interface SaleLineDto {
  productId: string;
  uom: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SaleDto {
  id: string;
  orderNo: string;
  cashierId: string;
  terminalId: string;
  branchId: string;
  customerId?: string;
  shiftId: string;
  lines: SaleLineDto[];
  payments: PaymentLineDto[];
  changeGiven: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: "completed" | "voided" | "parked";
  idempotencyKey: string;
  overrideApprovedBy?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt: string;
}

export interface ReceiptDto {
  businessName: string;
  currencySymbol: string;
  receiptFooterText?: string;
  orderNo: string;
  createdAt: string;
  lines: SaleLineDto[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  payments: PaymentLineDto[];
  changeGiven: number;
}
