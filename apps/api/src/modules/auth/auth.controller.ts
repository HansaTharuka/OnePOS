import { Body, Controller, Post } from '@nestjs/common';
import { loginDtoSchema } from '@onepos/shared-types';
import type { LoginDto } from '@onepos/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body(new ZodValidationPipe(loginDtoSchema)) body: LoginDto) {
    return this.authService.login(body);
  }
}
