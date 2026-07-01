import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type InventoryDocument = HydratedDocument<Inventory>;

/**
 * Per-branch stock level (docs/02-data-model.md) — never embedded in the
 * product doc. `qtyOnHand`/`qtyReserved` are always in the product's base
 * UOM. The only writers are GRN (increase), sale (decrease), or a future
 * stockAdjustment (correction) — see InventoryService.
 */
@Schema({ timestamps: true, collection: 'inventory' })
export class Inventory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, default: 'main' })
  branchId!: string;

  @Prop({ required: true, default: 0 })
  qtyOnHand!: number;

  @Prop({ required: true, default: 0 })
  qtyReserved!: number;

  /** Weighted-average cost per base unit, in integer cents. */
  @Prop({ required: true, default: 0 })
  avgCost!: number;

  @Prop()
  lastCountedAt?: Date;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ productId: 1, branchId: 1 }, { unique: true });
