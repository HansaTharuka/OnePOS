import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CaslAction,
  CaslSubject,
  cashDrawerMovementDtoSchema,
  closeShiftDtoSchema,
  openShiftDtoSchema,
} from '@onepos/shared-types';
import type {
  CashDrawerMovementDto,
  CloseShiftDto,
  OpenShiftDto,
} from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import type { RequestUser } from '../../common/types/request-user';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth('access-token')
@Controller('shifts')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @ApiOperation({ summary: 'Open a new till shift for the current cashier' })
  @ApiBody({ schema: zodApiSchema(openShiftDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.SHIFT })
  openShift(
    @Body(new ZodValidationPipe(openShiftDtoSchema)) body: OpenShiftDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shiftsService.openShift(body, user.id);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a shift and reconcile the till' })
  @ApiBody({ schema: zodApiSchema(closeShiftDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.SHIFT })
  closeShift(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeShiftDtoSchema)) body: CloseShiftDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shiftsService.closeShift(id, body, user);
  }

  @Get('current')
  @ApiOperation({
    summary:
      "Get the current cashier's open shift for a terminal, or null if none",
  })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SHIFT })
  findCurrent(
    @Query('terminalId') terminalId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shiftsService.findCurrent(user.id, terminalId);
  }

  @Get()
  @ApiOperation({ summary: 'List shifts (own only, unless manager-tier)' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SHIFT })
  findAll(@CurrentUser() user: RequestUser) {
    return this.shiftsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SHIFT })
  findOne(@Param('id') id: string) {
    return this.shiftsService.findById(id);
  }

  @Post(':id/cash-movements')
  @ApiOperation({
    summary:
      'Record a cash-drawer movement (paid-in/paid-out/drop); paid-out and drop require a manager PIN',
  })
  @ApiBody({ schema: zodApiSchema(cashDrawerMovementDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.SHIFT })
  recordCashMovement(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cashDrawerMovementDtoSchema))
    body: CashDrawerMovementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shiftsService.recordCashMovement(id, body, user);
  }

  @Get(':id/cash-movements')
  @ApiOperation({ summary: 'List cash-drawer movements for a shift' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SHIFT })
  findMovements(@Param('id') id: string) {
    return this.shiftsService.findMovements(id);
  }
}
