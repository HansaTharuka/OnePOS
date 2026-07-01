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
  createCategoryDtoSchema,
  updateCategoryDtoSchema,
} from '@onepos/shared-types';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@Controller('categories')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.CATEGORY })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.CATEGORY })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiBody({ schema: zodApiSchema(createCategoryDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.CATEGORY })
  create(
    @Body(new ZodValidationPipe(createCategoryDtoSchema))
    body: CreateCategoryDto,
  ) {
    return this.categoriesService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiBody({ schema: zodApiSchema(updateCategoryDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.CATEGORY })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategoryDtoSchema))
    body: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category' })
  @CheckAbility({ action: CaslAction.DELETE, subject: CaslSubject.CATEGORY })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
