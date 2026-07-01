import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shift, ShiftSchema } from './schemas/shift.schema';
import {
  CashDrawerMovement,
  CashDrawerMovementSchema,
} from './schemas/cash-drawer-movement.schema';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { CaslModule } from '../../common/casl/casl.module';
import { CounterModule } from '../../common/counters/counter.module';
import { ManagerPinModule } from '../../common/manager-pin/manager-pin.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shift.name, schema: ShiftSchema },
      { name: CashDrawerMovement.name, schema: CashDrawerMovementSchema },
      // Read-only access to the Sale collection for cash reconciliation on
      // close-out — registered directly (not via SalesModule) to avoid a
      // circular module dependency, since SalesModule needs the Shift
      // schema too. See docs/09-implementation-status.md Phase 3 notes.
      { name: Sale.name, schema: SaleSchema },
    ]),
    CaslModule,
    CounterModule,
    ManagerPinModule,
  ],
  providers: [ShiftsService],
  controllers: [ShiftsController],
  exports: [ShiftsService],
})
export class ShiftsModule {}
