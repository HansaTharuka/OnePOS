import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BrandDocument = HydratedDocument<Brand>;

@Schema({ timestamps: true, collection: 'brands' })
export class Brand {
  @Prop({ required: true, trim: true })
  name!: string;

  /** Unvalidated — no `suppliers` collection yet (see docs/09-implementation-status.md). */
  @Prop({ type: [String], default: [] })
  supplierIds!: string[];
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
