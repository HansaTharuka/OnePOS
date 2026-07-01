import { z } from "zod";

export const createGrnLineDtoSchema = z.object({
  productId: z.string(),
  uom: z.string().min(1),
  qtyReceived: z.number().positive(),
  unitCost: z.number().int().nonnegative(),
  batchNo: z.string().optional(),
});
export type CreateGrnLineDto = z.infer<typeof createGrnLineDtoSchema>;

export const createGrnDtoSchema = z.object({
  poId: z.string().optional(),
  branchId: z.string().default("main"),
  lines: z.array(createGrnLineDtoSchema).min(1),
  discrepancyNotes: z.string().optional(),
});
export type CreateGrnDto = z.infer<typeof createGrnDtoSchema>;

export interface GrnDto {
  id: string;
  grnNumber: string;
  poId?: string;
  branchId: string;
  lines: CreateGrnLineDto[];
  receivedBy: string;
  discrepancyNotes?: string;
  createdAt: string;
}
