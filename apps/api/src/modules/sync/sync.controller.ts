import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CaslAction,
  CaslSubject,
  syncPushRequestDtoSchema,
} from '@onepos/shared-types';
import type {
  SyncPullResponseDto,
  SyncPushRequestDto,
  SyncPushResponseDto,
} from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import type { RequestUser } from '../../common/types/request-user';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth('access-token')
@Controller('sync')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @ApiOperation({
    summary:
      'Replay a batch of queued offline sale events (Electron sync worker)',
  })
  @ApiBody({ schema: zodApiSchema(syncPushRequestDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.SALE })
  async push(
    @Body(new ZodValidationPipe(syncPushRequestDtoSchema))
    body: SyncPushRequestDto,
    @CurrentUser() user: RequestUser,
  ): Promise<SyncPushResponseDto> {
    const results = await this.syncService.pushEvents(
      body.events,
      user.id,
      user,
    );
    return { results };
  }

  @Get('pull')
  @ApiOperation({
    summary:
      'Clock-sync heartbeat for the offline sync worker (no catalog delta sync yet)',
  })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SALE })
  pull(): SyncPullResponseDto {
    return { serverTime: new Date().toISOString() };
  }
}
