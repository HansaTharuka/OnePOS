import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SaleDocument = HydratedDocument<Sale>;

/**
 * Snapshots price/tax/uom at time of sale — never live-references the
 * product doc afterward (docs/02-data-model.md), so old receipts/reports
 * stay accurate after a price change.
 */
@Schema({ _id: false })
export class SaleLine {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  uom!: string;

  @Prop({ required: true, min: 0 })
  qty!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ required: true, default: 0 })
  discount!: number;

  @Prop({ required: true, default: 0 })
  taxAmount!: number;

  @Prop({ required: true })
  lineTotal!: number;
}
export const SaleLineSchema = SchemaFactory.createForClass(SaleLine);

@Schema({ _id: false })
export class SalePaymentLine {
  @Prop({ required: true, enum: ['cash', 'card', 'mobile', 'credit'] })
  method!: 'cash' | 'card' | 'mobile' | 'credit';

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop()
  reference?: string;
}
export const SalePaymentLineSchema =
  SchemaFactory.createForClass(SalePaymentLine);

@Schema({ timestamps: true, collection: 'sales' })
export class Sale {
  @Prop({ required: true, unique: true })
  orderNo!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  cashierId!: Types.ObjectId;

  @Prop({ required: true })
  terminalId!: string;

  @Prop({ required: true, default: 'main' })
  branchId!: string;

  @Prop()
  customerId?: string;

  @Prop({ required: true })
  shiftId!: string;

  @Prop({ type: [SaleLineSchema], required: true })
  lines!: SaleLine[];

  @Prop({ type: [SalePaymentLineSchema], required: true, default: [] })
  payments!: SalePaymentLine[];

  @Prop({ required: true, min: 0, default: 0 })
  changeGiven!: number;

  @Prop({ required: true })
  subtotal!: number;

  @Prop({ required: true })
  taxTotal!: number;

  @Prop({ required: true })
  grandTotal!: number;

  @Prop({
    required: true,
    enum: ['completed', 'voided', 'parked'],
    default: 'completed',
  })
  status!: 'completed' | 'voided' | 'parked';

  /** Client-generated — lets an offline-sync retry replay safely (docs/05). */
  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  /** Set when a cashier-tier line discount exceeded the policy cap and a manager PIN approved it. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  overrideApprovedBy?: Types.ObjectId;

  /** The manager who authorized a void, via PIN — set only on `status: 'voided'`. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  voidedBy?: Types.ObjectId;

  @Prop()
  voidReason?: string;

  /** Set only when this sale was created via offline sync replay and the
   * stock decrement was forced through past a real stockout (see
   * modules/sync). */
  @Prop({ default: false })
  needsManagerReview?: boolean;

  @Prop()
  reviewReason?: string;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
