import { z } from "zod";

export const createBrandDtoSchema = z.object({
  name: z.string().min(1),
  supplierIds: z.array(z.string()).optional(),
});
export type CreateBrandDto = z.infer<typeof createBrandDtoSchema>;

export const updateBrandDtoSchema = createBrandDtoSchema.partial();
export type UpdateBrandDto = z.infer<typeof updateBrandDtoSchema>;

export interface BrandDto {
  id: string;
  name: string;
  supplierIds: string[];
  createdAt: string;
}
