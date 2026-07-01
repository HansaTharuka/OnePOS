import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SettingsDocument = HydratedDocument<Settings>;

/**
 * Singleton document — a single business per deployment (docs/README.md
 * scope decision), so there is always exactly one settings row.
 */
@Schema({ timestamps: true, collection: 'settings' })
export class Settings {
  @Prop({ required: true, default: 'OnePOS' })
  businessName!: string;

  @Prop()
  logoUrl?: string;

  @Prop({ required: true, default: 'USD' })
  currencyCode!: string;

  @Prop({ required: true, default: '$' })
  currencySymbol!: string;

  @Prop({ required: true, default: 0 })
  defaultTaxRatePercent!: number;

  @Prop({ required: true, default: 'INV' })
  invoicePrefix!: string;

  @Prop()
  receiptFooterText?: string;

  @Prop({
    required: true,
    default: 'block',
    enum: ['block', 'warn', 'allow_backorder'],
  })
  negativeStockPolicy!: 'block' | 'warn' | 'allow_backorder';
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
