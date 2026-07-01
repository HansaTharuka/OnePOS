import { z } from "zod";

export const loginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginDto = z.infer<typeof loginDtoSchema>;

export const pinLoginDtoSchema = z.object({
  userId: z.string(),
  pinCode: z.string().min(4).max(8),
});
export type PinLoginDto = z.infer<typeof pinLoginDtoSchema>;

export interface JwtClaims {
  sub: string; // user id
  email: string;
  roleId: string;
  roleName: string;
  terminalId?: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    roleName: string;
  };
}
