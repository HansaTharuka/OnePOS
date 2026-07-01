import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

/**
 * One sellable unit of measure for a product (docs/02-data-model.md) — e.g. a
 * box of screws sold per-piece AND per-box-of-100. `conversionFactor` is how
 * many base units make up one of this uom; the base unit itself has factor 1.
 */
@Schema({ _id: false })
export class UnitOfMeasure {
  @Prop({ required: true })
  uom!: string;

  @Prop({ required: true, min: 0 })
  conversionFactor!: number;

  @Prop()
  barcode?: string;

  /** Integer cents — never a float (docs/README.md). */
  @Prop({ required: true, min: 0 })
  costPrice!: number;

  @Prop({ required: true, min: 0 })
  sellPrice!: number;

  @Prop({ required: true, default: false })
  isBaseUnit!: boolean;
}
export const UnitOfMeasureSchema = SchemaFactory.createForClass(UnitOfMeasure);

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, unique: true, trim: true })
  sku!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  categoryId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand' })
  brandId?: Types.ObjectId;

  @Prop({ type: [UnitOfMeasureSchema], required: true })
  unitsOfMeasure!: UnitOfMeasure[];

  @Prop({ default: 0 })
  reorderPoint!: number;

  @Prop({ default: 0 })
  reorderQty!: number;

  @Prop({ default: false })
  isWeighted!: boolean;

  @Prop({ default: true })
  isTaxable!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  imageUrl?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
