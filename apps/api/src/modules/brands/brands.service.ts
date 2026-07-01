import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBrandDto, UpdateBrandDto } from '@onepos/shared-types';
import { Brand, BrandDocument } from './schemas/brand.schema';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name)
    private readonly brandModel: Model<BrandDocument>,
  ) {}

  create(dto: CreateBrandDto): Promise<BrandDocument> {
    return this.brandModel.create(dto);
  }

  findAll() {
    return this.brandModel.find().exec();
  }

  async findById(id: string): Promise<BrandDocument> {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) throw new NotFoundException('Brand not found.');
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDocument> {
    const brand = await this.brandModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!brand) throw new NotFoundException('Brand not found.');
    return brand;
  }

  async remove(id: string): Promise<void> {
    const result = await this.brandModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Brand not found.');
  }
}
