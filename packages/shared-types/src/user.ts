import { z } from "zod";

export const createUserDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string(),
  pinCode: z.string().min(4).max(8).optional(),
  isActive: z.boolean().default(true),
});
export type CreateUserDto = z.infer<typeof createUserDtoSchema>;

export const updateUserDtoSchema = createUserDtoSchema.partial().omit({ password: true });
export type UpdateUserDto = z.infer<typeof updateUserDtoSchema>;

export interface UserDto {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}
