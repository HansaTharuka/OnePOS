import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoodsReceivedNote, GrnSchema } from './schemas/grn.schema';
import { GoodsReceivedNotesService } from './goods-received-notes.service';
import { GoodsReceivedNotesController } from './goods-received-notes.controller';
import { CaslModule } from '../../common/casl/casl.module';
import { CounterModule } from '../../common/counters/counter.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GoodsReceivedNote.name, schema: GrnSchema },
    ]),
    CaslModule,
    CounterModule,
    ProductsModule,
    InventoryModule,
  ],
  providers: [GoodsReceivedNotesService],
  controllers: [GoodsReceivedNotesController],
  exports: [GoodsReceivedNotesService],
})
export class GoodsReceivedNotesModule {}
