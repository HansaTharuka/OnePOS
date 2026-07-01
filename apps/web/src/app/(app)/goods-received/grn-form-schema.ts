import { z } from "zod";
import { toMoneyCents, type CreateGrnDto } from "@onepos/shared-types";

/** Same dollars-vs-cents rationale as products/product-form-schema.ts. */
export const grnLineFormSchema = z.object({
  productId: z.string().min(1, "Required"),
  uom: z.string().min(1, "Required"),
  qtyReceived: z.coerce.number().positive("Must be positive"),
  unitCost: z.coerce.number().nonnegative("Must be 0 or more"),
  batchNo: z.string().optional(),
});

export const grnFormSchema = z.object({
  lines: z.array(grnLineFormSchema).min(1, "Add at least one line"),
  discrepancyNotes: z.string().optional(),
});

export type GrnFormValues = z.infer<typeof grnFormSchema>;

const BRANCH_ID = "main";

export function toCreateGrnDto(values: GrnFormValues): CreateGrnDto {
  return {
    branchId: BRANCH_ID,
    discrepancyNotes: values.discrepancyNotes || undefined,
    lines: values.lines.map((line) => ({
      ...line,
      batchNo: line.batchNo || undefined,
      unitCost: toMoneyCents(line.unitCost),
    })),
  };
}

export const emptyGrnLine = {
  productId: "",
  uom: "",
  qtyReceived: 1,
  unitCost: 0,
  batchNo: "",
};

export const defaultGrnFormValues: GrnFormValues = {
  lines: [{ ...emptyGrnLine }],
  discrepancyNotes: undefined,
};
