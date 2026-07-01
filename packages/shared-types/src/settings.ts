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
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/** Fields exposed to the unauthenticated /settings/public endpoint. */
export const publicSettingsSchema = businessSettingsSchema.pick({
  businessName: true,
  logoUrl: true,
  currencyCode: true,
  currencySymbol: true,
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
