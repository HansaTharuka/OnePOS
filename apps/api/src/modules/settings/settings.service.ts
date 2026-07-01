import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BusinessSettings,
  PublicSettings,
  publicSettingsSchema,
} from '@onepos/shared-types';
import { Settings, SettingsDocument } from './schemas/settings.schema';

/**
 * Business-facing settings, cached in-memory and refreshed on write.
 * See docs/04-configuration.md — no restart required for these changes.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private cache!: SettingsDocument;

  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  private async refreshCache(): Promise<void> {
    let doc = await this.settingsModel.findOne().exec();
    doc ??= await this.settingsModel.create({});
    this.cache = doc;
  }

  getAll(): BusinessSettings {
    return this.cache.toObject();
  }

  getPublic(): PublicSettings {
    return publicSettingsSchema.parse(this.cache.toObject());
  }

  async update(partial: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const updated = await this.settingsModel
      .findByIdAndUpdate(this.cache._id, partial, { new: true, upsert: true })
      .exec();
    this.cache = updated!;
    return this.getAll();
  }
}
