import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ShiftDocument = HydratedDocument<Shift>;

/**
 * A till session for one cashier at one terminal. `createdAt` (from
 * timestamps) serves as `openedAt` — see docs/09-implementation-status.md
 * Phase 3 notes.
 */
@Schema({ timestamps: true, collection: 'shifts' })
export class Shift {
  @Prop({ required: true, unique: true })
  shiftNo!: string;

  @Prop({ required: true })
  terminalId!: string;

  @Prop({ required: true, default: 'main' })
  branchId!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  cashierId!: Types.ObjectId;

  /** Integer cents. */
  @Prop({ required: true, min: 0 })
  openingFloat!: number;

  @Prop({ required: true, enum: ['open', 'closed'], default: 'open' })
  status!: 'open' | 'closed';

  @Prop()
  closedAt?: Date;

  @Prop()
  closingCountedCash?: number;

  @Prop()
  expectedCash?: number;

  @Prop()
  variance?: number;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);
