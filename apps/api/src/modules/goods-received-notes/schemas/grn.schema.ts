import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GrnDocument = HydratedDocument<GoodsReceivedNote>;

@Schema({ _id: false })
export class GrnLine {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  uom!: string;

  @Prop({ required: true, min: 0 })
  qtyReceived!: number;

  /** Integer cents, per the received uom (docs/README.md — never a float). */
  @Prop({ required: true, min: 0 })
  unitCost!: number;

  @Prop()
  batchNo?: string;
}
export const GrnLineSchema = SchemaFactory.createForClass(GrnLine);

/**
 * The actual stock-increasing event, deliberately decoupled from any
 * purchase order (docs/02-data-model.md) — `poId` is an unvalidated string
 * since there's no `purchaseOrders` collection yet.
 */
@Schema({ timestamps: true, collection: 'goodsReceivedNotes' })
export class GoodsReceivedNote {
  @Prop({ required: true, unique: true })
  grnNumber!: string;

  @Prop()
  poId?: string;

  @Prop({ required: true, default: 'main' })
  branchId!: string;

  @Prop({ type: [GrnLineSchema], required: true })
  lines!: GrnLine[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  receivedBy!: Types.ObjectId;

  @Prop()
  discrepancyNotes?: string;
}

export const GrnSchema = SchemaFactory.createForClass(GoodsReceivedNote);
