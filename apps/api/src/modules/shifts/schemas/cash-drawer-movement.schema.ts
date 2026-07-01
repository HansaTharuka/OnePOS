import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CashDrawerMovementDocument = HydratedDocument<CashDrawerMovement>;

/**
 * Every cash-drawer event for a shift, including the opening float itself
 * (type `'opening'`) — so a shift's full cash trail is reconstructable from
 * one collection. `paid-out`/`drop` require manager-PIN approval, hence
 * `authorizedBy`; `paid-in`/`opening` don't.
 */
@Schema({ timestamps: true, collection: 'cashDrawerMovements' })
export class CashDrawerMovement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Shift', required: true })
  shiftId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['opening', 'paid-in', 'paid-out', 'drop'],
  })
  type!: 'opening' | 'paid-in' | 'paid-out' | 'drop';

  /** Integer cents, always positive regardless of direction. */
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop()
  reason?: string;

  /** The manager who approved a paid-out/drop — unset for opening/paid-in. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  authorizedBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recordedBy!: Types.ObjectId;
}

export const CashDrawerMovementSchema =
  SchemaFactory.createForClass(CashDrawerMovement);
