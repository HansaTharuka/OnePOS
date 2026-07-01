import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  businessSettingsSchema,
  CaslAction,
  CaslSubject,
} from '@onepos/shared-types';
import type { BusinessSettings } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { SettingsService } from './settings.service';

const partialSettingsSchema = businessSettingsSchema.partial();

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Unauthenticated — the Next.js frontend fetches this on load for branding/currency. */
  @Get('public')
  @ApiOperation({
    summary: 'Get public branding/currency settings (no auth required)',
  })
  getPublic() {
    return this.settingsService.getPublic();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all business settings (admin)' })
  @UseGuards(JwtAuthGuard, CaslAbilityGuard)
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SETTINGS })
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update business settings (admin)' })
  @ApiBody({ schema: zodApiSchema(partialSettingsSchema) })
  @UseGuards(JwtAuthGuard, CaslAbilityGuard)
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.SETTINGS })
  update(
    @Body(new ZodValidationPipe(partialSettingsSchema))
    body: Partial<BusinessSettings>,
  ) {
    return this.settingsService.update(body);
  }
}
