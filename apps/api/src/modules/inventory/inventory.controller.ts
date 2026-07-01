import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaslAction, CaslSubject } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { InventoryService } from './inventory.service';

/**
 * Read-only — qtyOnHand only ever changes via GRN, sale, or a future
 * stockAdjustment (docs/02-data-model.md), never a direct PATCH here.
 */
@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List stock levels for all products' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.INVENTORY })
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get stock level for a product (default branch)' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.INVENTORY })
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findByProduct(productId);
  }
}
