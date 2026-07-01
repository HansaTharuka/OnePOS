import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

/** One doc per named sequence (e.g. "sales", "grn"); `_id` is the sequence name. */
@Schema({ collection: 'counters', _id: false })
export class Counter {
  @Prop({ required: true })
  _id!: string;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
