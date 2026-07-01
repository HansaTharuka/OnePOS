import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateProductDto,
  UnitOfMeasure,
  UpdateProductDto,
} from '@onepos/shared-types';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    this.assertSingleBaseUnit(dto.unitsOfMeasure);
    await this.assertBarcodesAvailable(dto.unitsOfMeasure);

    const existingSku = await this.productModel
      .findOne({ sku: dto.sku })
      .exec();
    if (existingSku) {
      throw new ConflictException('A product with this SKU already exists.');
    }

    return this.productModel.create(dto);
  }

  findAll() {
    return this.productModel.find().exec();
  }

  async findById(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    if (dto.unitsOfMeasure) {
      this.assertSingleBaseUnit(dto.unitsOfMeasure);
      await this.assertBarcodesAvailable(dto.unitsOfMeasure, id);
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  /** Resolves the UOM entry a sale/GRN line refers to, e.g. "box" vs "piece". */
  getUomEntry(product: ProductDocument, uom: string): UnitOfMeasure {
    const entry = product.unitsOfMeasure.find((u) => u.uom === uom);
    if (!entry) {
      throw new BadRequestException(
        `Product "${product.sku}" has no unit of measure "${uom}".`,
      );
    }
    return entry;
  }

  private assertSingleBaseUnit(unitsOfMeasure: UnitOfMeasure[]): void {
    const baseUnitCount = unitsOfMeasure.filter((u) => u.isBaseUnit).length;
    if (baseUnitCount !== 1) {
      throw new BadRequestException(
        'A product must have exactly one base unit of measure.',
      );
    }
  }

  private async assertBarcodesAvailable(
    unitsOfMeasure: UnitOfMeasure[],
    excludeProductId?: string,
  ): Promise<void> {
    const barcodes = unitsOfMeasure
      .map((u) => u.barcode)
      .filter((b): b is string => !!b);
    if (barcodes.length === 0) return;

    const conflict = await this.productModel
      .findOne({
        _id: { $ne: excludeProductId },
        'unitsOfMeasure.barcode': { $in: barcodes },
      })
      .exec();
    if (conflict) {
      throw new ConflictException(
        'One or more barcodes are already assigned to another product.',
      );
    }
  }
}
