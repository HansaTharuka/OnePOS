import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateGrnDto } from '@onepos/shared-types';
import { CounterService } from '../../common/counters/counter.service';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { GoodsReceivedNote, GrnDocument } from './schemas/grn.schema';

@Injectable()
export class GoodsReceivedNotesService {
  constructor(
    @InjectModel(GoodsReceivedNote.name)
    private readonly grnModel: Model<GrnDocument>,
    private readonly counterService: CounterService,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateGrnDto, receivedBy: string): Promise<GrnDocument> {
    for (const line of dto.lines) {
      const product = await this.productsService.findById(line.productId);
      const uomEntry = this.productsService.getUomEntry(product, line.uom);
      const baseQtyDelta = line.qtyReceived * uomEntry.conversionFactor;
      const unitCostBase = line.unitCost / uomEntry.conversionFactor;
      await this.inventoryService.incrementStock(
        line.productId,
        dto.branchId,
        baseQtyDelta,
        unitCostBase,
      );
    }

    const seq = await this.counterService.getNextSequence('grn');
    const grnNumber = `GRN-${seq}`;

    return this.grnModel.create({
      grnNumber,
      poId: dto.poId,
      branchId: dto.branchId,
      lines: dto.lines,
      receivedBy,
      discrepancyNotes: dto.discrepancyNotes,
    });
  }

  findAll() {
    return this.grnModel.find().exec();
  }

  async findById(id: string): Promise<GrnDocument> {
    const grn = await this.grnModel.findById(id).exec();
    if (!grn) throw new NotFoundException('Goods received note not found.');
    return grn;
  }
}
