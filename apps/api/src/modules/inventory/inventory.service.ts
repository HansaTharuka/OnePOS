import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';

type NegativeStockPolicy = 'block' | 'warn' | 'allow_backorder';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  findAll() {
    return this.inventoryModel.find().exec();
  }

  findByProduct(productId: string, branchId = 'main') {
    return this.inventoryModel.findOne({ productId, branchId }).exec();
  }

  /**
   * GRN stock increase. Uses an aggregation-pipeline update so the qty
   * increment and weighted-average cost recompute happen atomically in one
   * document write — safe even without a replica set / multi-doc transaction.
   */
  async incrementStock(
    productId: string,
    branchId: string,
    baseQtyDelta: number,
    unitCostBase: number,
  ): Promise<InventoryDocument> {
    const doc = await this.inventoryModel
      .findOneAndUpdate(
        { productId, branchId },
        [
          {
            // Aggregation-pipeline stages aren't schema-cast by Mongoose, so
            // the insert-only fallback here needs an explicit ObjectId.
            $set: {
              productId: {
                $ifNull: ['$productId', new Types.ObjectId(productId)],
              },
              branchId: { $ifNull: ['$branchId', branchId] },
              qtyReserved: { $ifNull: ['$qtyReserved', 0] },
              avgCost: {
                $let: {
                  vars: {
                    existingQty: { $ifNull: ['$qtyOnHand', 0] },
                    existingAvg: { $ifNull: ['$avgCost', 0] },
                  },
                  in: {
                    $cond: [
                      { $eq: [{ $add: ['$$existingQty', baseQtyDelta] }, 0] },
                      0,
                      {
                        $divide: [
                          {
                            $add: [
                              { $multiply: ['$$existingQty', '$$existingAvg'] },
                              { $multiply: [baseQtyDelta, unitCostBase] },
                            ],
                          },
                          { $add: ['$$existingQty', baseQtyDelta] },
                        ],
                      },
                    ],
                  },
                },
              },
              qtyOnHand: {
                $add: [{ $ifNull: ['$qtyOnHand', 0] }, baseQtyDelta],
              },
            },
          },
        ],
        { new: true, upsert: true },
      )
      .exec();
    return doc;
  }

  /**
   * Sale stock decrease. `block` uses a guarded conditional update — the
   * standard fix for concurrent-oversell races (docs/01-architecture-overview.md)
   * — and throws if there isn't enough stock. `warn`/`allow_backorder` decrement
   * unconditionally (warn also logs).
   */
  async decrementStockAtomic(
    productId: string,
    branchId: string,
    baseQty: number,
    policy: NegativeStockPolicy,
  ): Promise<InventoryDocument> {
    if (policy === 'block') {
      const doc = await this.inventoryModel
        .findOneAndUpdate(
          { productId, branchId, qtyOnHand: { $gte: baseQty } },
          { $inc: { qtyOnHand: -baseQty } },
          { new: true },
        )
        .exec();
      if (!doc) {
        throw new ConflictException(
          `Insufficient stock for product ${productId}.`,
        );
      }
      return doc;
    }

    const doc = await this.inventoryModel
      .findOneAndUpdate(
        { productId, branchId },
        { $inc: { qtyOnHand: -baseQty } },
        { new: true, upsert: true },
      )
      .exec();
    if (policy === 'warn' && doc.qtyOnHand < 0) {
      this.logger.warn(
        `Stock for product ${productId} went negative (${doc.qtyOnHand}) on branch ${branchId}.`,
      );
    }
    return doc;
  }

  /** Undoes a decrement (compensating action) when a later line in the same sale fails. */
  async reverseDecrement(
    productId: string,
    branchId: string,
    baseQty: number,
  ): Promise<void> {
    await this.inventoryModel
      .findOneAndUpdate(
        { productId, branchId },
        { $inc: { qtyOnHand: baseQty } },
        { upsert: true },
      )
      .exec();
  }
}
