import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CaslAction,
  CaslSubject,
  createSaleDtoSchema,
  parkSaleDtoSchema,
  voidSaleDtoSchema,
} from '@onepos/shared-types';
import type {
  CreateSaleDto,
  ParkSaleDto,
  VoidSaleDto,
} from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import type { RequestUser } from '../../common/types/request-user';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth('access-token')
@Controller('sales')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'List all sales' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SALE })
  findAll() {
    return this.salesService.findAll();
  }

  // Declared before the `:id` wildcard routes below so "parked" isn't
  // matched as a sale id.
  @Get('parked')
  @ApiOperation({
    summary: 'List parked (held) sales (own only, unless manager-tier)',
  })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SALE })
  findParked(@CurrentUser() user: RequestUser) {
    return this.salesService.findParked(user);
  }

  @Post('park')
  @ApiOperation({
    summary: 'Park (hold) a cart for later resume — no stock/financial impact',
  })
  @ApiBody({ schema: zodApiSchema(parkSaleDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.SALE })
  park(
    @Body(new ZodValidationPipe(parkSaleDtoSchema)) body: ParkSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.park(body, user.id);
  }

  @Delete('parked/:id')
  @ApiOperation({
    summary: 'Discard a parked sale (own only, unless manager-tier)',
  })
  @CheckAbility({ action: CaslAction.DELETE, subject: CaslSubject.SALE })
  deleteParked(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.salesService.deleteParked(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sale by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SALE })
  findOne(@Param('id') id: string) {
    return this.salesService.findById(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get a printable receipt payload for a sale' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.SALE })
  getReceipt(@Param('id') id: string) {
    return this.salesService.getReceipt(id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Complete a sale (cart -> stock decrement -> completed sale), with split/multi payments',
  })
  @ApiBody({ schema: zodApiSchema(createSaleDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.SALE })
  create(
    @Body(new ZodValidationPipe(createSaleDtoSchema)) body: CreateSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.create(body, user.id, user);
  }

  @Post(':id/void')
  @ApiOperation({
    summary:
      "Void a completed sale and reverse its stock decrement. Requires a valid manager PIN — deliberately a base CREATE check here since the manager PIN itself is the real step-up authority, not the caller's own role.",
  })
  @ApiBody({ schema: zodApiSchema(voidSaleDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.SALE })
  voidSale(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidSaleDtoSchema)) body: VoidSaleDto,
  ) {
    return this.salesService.voidSale(id, body);
  }
}
