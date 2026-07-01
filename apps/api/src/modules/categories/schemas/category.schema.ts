import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  parentCategoryId?: Types.ObjectId;

  @Prop()
  imagePath?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
