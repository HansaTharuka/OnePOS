import { z } from "zod";
import { toMoneyCents, type CreateProductDto } from "@onepos/shared-types";

/**
 * The server's `createProductDtoSchema` requires costPrice/sellPrice as integer cents, but a
 * cashier/admin naturally types dollars-and-cents. This form schema mirrors the server schema
 * field-for-field except money (dollars here, converted with `toMoneyCents` in `toCreateProductDto`
 * below) so the two can't silently drift apart.
 */
export const unitOfMeasureFormSchema = z
  .object({
    uom: z.string().min(1, "Required"),
    conversionFactor: z.coerce.number().positive("Must be positive"),
    barcode: z.string().optional(),
    costPrice: z.coerce.number().nonnegative("Must be 0 or more"),
    sellPrice: z.coerce.number().nonnegative("Must be 0 or more"),
    isBaseUnit: z.boolean(),
  })
  .strict();

export const productFormSchema = z
  .object({
    sku: z.string().min(1, "Required"),
    name: z.string().min(1, "Required"),
    categoryId: z.string().min(1, "Category is required"),
    brandId: z.string().optional(),
    unitsOfMeasure: z.array(unitOfMeasureFormSchema).min(1, "Add at least one unit of measure"),
    reorderPoint: z.coerce.number().nonnegative(),
    reorderQty: z.coerce.number().nonnegative(),
    isWeighted: z.boolean(),
    isTaxable: z.boolean(),
    isActive: z.boolean(),
    imageUrl: z.string().optional(),
  })
  .refine((data) => data.unitsOfMeasure.filter((u) => u.isBaseUnit).length === 1, {
    message: "Exactly one unit of measure must be marked as the base unit.",
    path: ["unitsOfMeasure"],
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export function toCreateProductDto(values: ProductFormValues): CreateProductDto {
  return {
    ...values,
    brandId: values.brandId || undefined,
    imageUrl: values.imageUrl || undefined,
    unitsOfMeasure: values.unitsOfMeasure.map((u) => ({
      ...u,
      barcode: u.barcode || undefined,
      costPrice: toMoneyCents(u.costPrice),
      sellPrice: toMoneyCents(u.sellPrice),
    })),
  };
}

export const emptyUnitOfMeasure = {
  uom: "",
  conversionFactor: 1,
  barcode: "",
  costPrice: 0,
  sellPrice: 0,
  isBaseUnit: false,
};

export const defaultProductFormValues: ProductFormValues = {
  sku: "",
  name: "",
  categoryId: "",
  brandId: undefined,
  unitsOfMeasure: [{ ...emptyUnitOfMeasure, isBaseUnit: true }],
  reorderPoint: 0,
  reorderQty: 0,
  isWeighted: false,
  isTaxable: true,
  isActive: true,
  imageUrl: undefined,
};
