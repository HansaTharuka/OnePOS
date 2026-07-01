import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCategoryDto, UpdateCategoryDto } from '@onepos/shared-types';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    if (dto.parentCategoryId) {
      await this.findById(dto.parentCategoryId);
    }
    return this.categoryModel.create(dto);
  }

  findAll() {
    return this.categoryModel.find().exec();
  }

  async findById(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    if (dto.parentCategoryId === id) {
      throw new BadRequestException('A category cannot be its own parent.');
    }
    if (dto.parentCategoryId) {
      await this.findById(dto.parentCategoryId);
    }
    const category = await this.categoryModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async remove(id: string): Promise<void> {
    const hasChildren = await this.categoryModel
      .exists({ parentCategoryId: id })
      .exec();
    if (hasChildren) {
      throw new BadRequestException(
        'Cannot delete a category that has child categories.',
      );
    }
    const result = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Category not found.');
  }
}
