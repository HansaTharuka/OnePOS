import { ConflictException } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, Types } from 'mongoose';
import { InventoryService } from './inventory.service';
import {
  Inventory,
  InventoryDocument,
  InventorySchema,
} from './schemas/inventory.schema';

jest.setTimeout(30000);

// The first-ever run on a machine downloads a ~780MB mongod binary, which can
// take much longer than the default per-test timeout; subsequent runs reuse
// the cached binary and start in a second or two, so only this hook needs a
// generous timeout.
const MONGO_STARTUP_TIMEOUT = 300000;

describe('InventoryService concurrency (real in-memory MongoDB)', () => {
  let mongoServer: MongoMemoryServer;
  let inventoryModel: Model<InventoryDocument>;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    inventoryModel = mongoose.model(
      Inventory.name,
      InventorySchema,
    ) as unknown as Model<InventoryDocument>;
    inventoryService = new InventoryService(inventoryModel);
  }, MONGO_STARTUP_TIMEOUT);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  let productId: Types.ObjectId;

  beforeEach(async () => {
    await inventoryModel.deleteMany({});
    productId = new Types.ObjectId();
  });

  async function seed(qtyOnHand: number) {
    await inventoryModel.create({
      productId,
      branchId: 'main',
      qtyOnHand,
      qtyReserved: 0,
      avgCost: 100,
    });
  }

  it('allows exactly as many concurrent decrements to succeed as there is stock, never overselling', async () => {
    await seed(10);

    // All 20 calls are invoked up front (not awaited individually) so their
    // underlying findOneAndUpdate network calls to the in-memory Mongo
    // server genuinely overlap in flight; Promise.allSettled then waits for
    // every outcome without short-circuiting on the first rejection.
    const attempts = Array.from({ length: 20 }, () =>
      inventoryService.decrementStockAtomic(
        productId.toString(),
        'main',
        1,
        'block',
      ),
    );
    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(10);
    expect(rejected).toHaveLength(10);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ConflictException);
    }

    const finalDoc = await inventoryModel
      .findOne({ productId, branchId: 'main' })
      .exec();
    expect(finalDoc?.qtyOnHand).toBe(0);
  });

  it('lets all concurrent decrements succeed when stock exactly matches demand', async () => {
    await seed(3);

    const attempts = Array.from({ length: 3 }, () =>
      inventoryService.decrementStockAtomic(
        productId.toString(),
        'main',
        1,
        'block',
      ),
    );
    const results = await Promise.allSettled(attempts);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);

    const finalDoc = await inventoryModel
      .findOne({ productId, branchId: 'main' })
      .exec();
    expect(finalDoc?.qtyOnHand).toBe(0);
  });
});
