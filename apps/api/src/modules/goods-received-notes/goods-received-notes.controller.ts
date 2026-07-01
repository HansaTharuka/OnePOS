import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CaslAction,
  CaslSubject,
  createGrnDtoSchema,
} from '@onepos/shared-types';
import type { CreateGrnDto } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import type { RequestUser } from '../../common/types/request-user';
import { GoodsReceivedNotesService } from './goods-received-notes.service';

@ApiTags('goods-received-notes')
@ApiBearerAuth('access-token')
@Controller('goods-received-notes')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class GoodsReceivedNotesController {
  constructor(private readonly grnService: GoodsReceivedNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all goods received notes' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.GRN })
  findAll() {
    return this.grnService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a goods received note by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.GRN })
  findOne(@Param('id') id: string) {
    return this.grnService.findById(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Receive stock against a GRN (the stock-increasing event)',
  })
  @ApiBody({ schema: zodApiSchema(createGrnDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.GRN })
  create(
    @Body(new ZodValidationPipe(createGrnDtoSchema)) body: CreateGrnDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.grnService.create(body, user.id);
  }
}
