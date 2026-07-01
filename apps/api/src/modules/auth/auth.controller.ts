import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loginDtoSchema } from '@onepos/shared-types';
import type { LoginDto } from '@onepos/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password, receive a JWT' })
  @ApiBody({ schema: zodApiSchema(loginDtoSchema) })
  login(@Body(new ZodValidationPipe(loginDtoSchema)) body: LoginDto) {
    return this.authService.login(body);
  }
}
