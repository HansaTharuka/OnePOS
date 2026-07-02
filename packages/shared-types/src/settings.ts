import { z } from "zod";

/**
 * Business-facing settings persisted in the `settings` collection.
 * See docs/04-configuration.md — hot-swappable, cached, no restart required.
 */
export const businessSettingsSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().optional(),
  currencyCode: z.string().length(3).default("USD"),
  currencySymbol: z.string().default("$"),
  defaultTaxRatePercent: z.number().min(0).max(100).default(0),
  invoicePrefix: z.string().default("INV"),
  receiptFooterText: z.string().optional(),
  negativeStockPolicy: z.enum(["block", "warn", "allow_backorder"]).default("block"),
  /** Cashier line discounts above this % require manager-PIN override (see Phase 3). */
  maxCashierDiscountPercent: z.number().min(0).max(100).default(20),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/**
 * Fields exposed to the unauthenticated /settings/public endpoint. `defaultTaxRatePercent` is
 * included so the cashier POS screen (which has no `read Settings` permission — see
 * roles.seed.ts) can show an accurate running total; it's not sensitive, it's printed on every
 * receipt anyway. `maxCashierDiscountPercent` is included (Phase 4) so the offline checkout path
 * can advise the cashier client-side that a discount needs manager approval *before* queuing a
 * sale that's guaranteed to fail replay (no server round-trip is possible offline to react to a
 * 400 the way the online reactive-PIN-prompt flow does) — knowing the threshold doesn't help
 * bypass it, the server always re-checks it authoritatively on replay.
 */
export const publicSettingsSchema = businessSettingsSchema.pick({
  businessName: true,
  logoUrl: true,
  currencyCode: true,
  currencySymbol: true,
  defaultTaxRatePercent: true,
  maxCashierDiscountPercent: true,
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
