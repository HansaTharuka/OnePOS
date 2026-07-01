import { z } from "zod";

export const createCategoryDtoSchema = z.object({
  name: z.string().min(1),
  parentCategoryId: z.string().optional(),
  imagePath: z.string().optional(),
});
export type CreateCategoryDto = z.infer<typeof createCategoryDtoSchema>;

export const updateCategoryDtoSchema = createCategoryDtoSchema.partial();
export type UpdateCategoryDto = z.infer<typeof updateCategoryDtoSchema>;

export interface CategoryDto {
  id: string;
  name: string;
  parentCategoryId?: string;
  imagePath?: string;
  createdAt: string;
}
