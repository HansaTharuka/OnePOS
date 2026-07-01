import { z } from "zod";

/**
 * One entry per sellable unit of measure for a product (docs/02-data-model.md) —
 * e.g. a box of screws sold per-piece AND per-box-of-100. `conversionFactor` is
 * "how many base units make up one of this uom" (the base unit itself has
 * conversionFactor 1). Prices are integer cents (docs/README.md).
 */
export const unitOfMeasureSchema = z.object({
  uom: z.string().min(1),
  conversionFactor: z.number().positive(),
  barcode: z.string().optional(),
  costPrice: z.number().int().nonnegative(),
  sellPrice: z.number().int().nonnegative(),
  isBaseUnit: z.boolean(),
});
export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;

export const createProductDtoSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string(),
  brandId: z.string().optional(),
  unitsOfMeasure: z.array(unitOfMeasureSchema).min(1),
  reorderPoint: z.number().nonnegative().default(0),
  reorderQty: z.number().nonnegative().default(0),
  isWeighted: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  imageUrl: z.string().optional(),
});
export type CreateProductDto = z.infer<typeof createProductDtoSchema>;

export const updateProductDtoSchema = createProductDtoSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductDtoSchema>;

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brandId?: string;
  unitsOfMeasure: UnitOfMeasure[];
  reorderPoint: number;
  reorderQty: number;
  isWeighted: boolean;
  isTaxable: boolean;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
}
