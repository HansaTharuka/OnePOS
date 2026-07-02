import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loginDtoSchema, setupDtoSchema } from '@onepos/shared-types';
import type { LoginDto, SetupDto } from '@onepos/shared-types';
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

  /** Unauthenticated — locks itself once a user already exists (see AuthService.setup). */
  @Get('setup-status')
  @ApiOperation({
    summary: 'Whether the first-run admin setup wizard is needed',
  })
  getSetupStatus() {
    return this.authService.getSetupStatus();
  }

  @Post('setup')
  @ApiOperation({
    summary: 'Create the first admin account on a fresh install',
  })
  @ApiBody({ schema: zodApiSchema(setupDtoSchema) })
  setup(@Body(new ZodValidationPipe(setupDtoSchema)) body: SetupDto) {
    return this.authService.setup(body);
  }
}
