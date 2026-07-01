import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sale, SaleSchema } from './schemas/sale.schema';
import { Shift, ShiftSchema } from '../shifts/schemas/shift.schema';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { CaslModule } from '../../common/casl/casl.module';
import { CounterModule } from '../../common/counters/counter.module';
import { ManagerPinModule } from '../../common/manager-pin/manager-pin.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      // Read-only access to the Shift collection to validate the sale's
      // open shift — registered directly (not via ShiftsModule) to avoid a
      // circular module dependency, since ShiftsModule needs the Sale
      // schema too. See docs/09-implementation-status.md Phase 3 notes.
      { name: Shift.name, schema: ShiftSchema },
    ]),
    CaslModule,
    CounterModule,
    ManagerPinModule,
    ProductsModule,
    InventoryModule,
    SettingsModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
