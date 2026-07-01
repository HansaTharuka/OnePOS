import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CaslAction,
  CaslSubject,
  createBrandDtoSchema,
  updateBrandDtoSchema,
} from '@onepos/shared-types';
import type { CreateBrandDto, UpdateBrandDto } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { BrandsService } from './brands.service';

@ApiTags('brands')
@ApiBearerAuth('access-token')
@Controller('brands')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List all brands' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.BRAND })
  findAll() {
    return this.brandsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.BRAND })
  findOne(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a brand' })
  @ApiBody({ schema: zodApiSchema(createBrandDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.BRAND })
  create(
    @Body(new ZodValidationPipe(createBrandDtoSchema)) body: CreateBrandDto,
  ) {
    return this.brandsService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a brand' })
  @ApiBody({ schema: zodApiSchema(updateBrandDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.BRAND })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBrandDtoSchema)) body: UpdateBrandDto,
  ) {
    return this.brandsService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a brand' })
  @CheckAbility({ action: CaslAction.DELETE, subject: CaslSubject.BRAND })
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
