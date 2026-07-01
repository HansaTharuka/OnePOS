import {
  Body,
  Controller,
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
  createProductDtoSchema,
  updateProductDtoSchema,
} from '@onepos/shared-types';
import type { CreateProductDto, UpdateProductDto } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth('access-token')
@Controller('products')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.PRODUCT })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.PRODUCT })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @ApiBody({ schema: zodApiSchema(createProductDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.PRODUCT })
  create(
    @Body(new ZodValidationPipe(createProductDtoSchema))
    body: CreateProductDto,
  ) {
    return this.productsService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiBody({ schema: zodApiSchema(updateProductDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.PRODUCT })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductDtoSchema))
    body: UpdateProductDto,
  ) {
    return this.productsService.update(id, body);
  }
}
