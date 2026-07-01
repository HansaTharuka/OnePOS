import { z } from "zod";
import { PAYMENT_METHODS, toMoneyCents, type PaymentLineDto } from "@onepos/shared-types";

/**
 * Same dollars-vs-cents rationale as products/product-form-schema.ts: the server's
 * `paymentLineDtoSchema.amount` is integer cents, but a cashier naturally types dollars.
 */
export const paymentRowFormSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().positive("Must be positive"),
  reference: z.string().optional(),
});

export const checkoutFormSchema = z.object({
  payments: z.array(paymentRowFormSchema).min(1, "Add at least one tender"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export function toPaymentLines(values: CheckoutFormValues): PaymentLineDto[] {
  return values.payments.map((p) => ({
    method: p.method,
    amount: toMoneyCents(p.amount),
    reference: p.reference || undefined,
  }));
}

/** Sum of every tender row, in integer cents — used for the live remaining-balance display. */
export function sumPaymentsCents(values: Pick<CheckoutFormValues, "payments">): number {
  return values.payments.reduce((sum, p) => sum + toMoneyCents(Number(p.amount) || 0), 0);
}

export const emptyPaymentRow = { method: "cash" as const, amount: 0, reference: "" };
