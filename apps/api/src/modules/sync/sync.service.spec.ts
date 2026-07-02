import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, Types } from 'mongoose';
import type { BusinessSettings } from '@onepos/shared-types';
import { CounterService } from '../../common/counters/counter.service';
import {
  Counter,
  CounterDocument,
  CounterSchema,
} from '../../common/counters/counter.schema';
import type { RequestUser } from '../../common/types/request-user';
import type { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import type { ManagerPinService } from '../../common/manager-pin/manager-pin.service';
import { ProductsService } from '../products/products.service';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from '../products/schemas/product.schema';
import { InventoryService } from '../inventory/inventory.service';
import {
  Inventory,
  InventoryDocument,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import type { SettingsService } from '../settings/settings.service';
import {
  Shift,
  ShiftDocument,
  ShiftSchema,
} from '../shifts/schemas/shift.schema';
import { Sale, SaleDocument, SaleSchema } from '../sales/schemas/sale.schema';
import { SalesService } from '../sales/sales.service';
import { SyncService } from './sync.service';

jest.setTimeout(30000);

// The first-ever run on a machine downloads a ~780MB mongod binary — see
// inventory.concurrency.spec.ts for the same generous first-run timeout.
const MONGO_STARTUP_TIMEOUT = 300000;

const SETTINGS: BusinessSettings = {
  businessName: 'Test Shop',
  currencyCode: 'USD',
  currencySymbol: '$',
  defaultTaxRatePercent: 0,
  invoicePrefix: 'INV',
  negativeStockPolicy: 'block',
  maxCashierDiscountPercent: 20,
};

describe('SyncService.pushEvents (real in-memory MongoDB)', () => {
  let mongoServer: MongoMemoryServer;
  let saleModel: Model<SaleDocument>;
  let shiftModel: Model<ShiftDocument>;
  let productModel: Model<ProductDocument>;
  let inventoryModel: Model<InventoryDocument>;
  let counterModel: Model<CounterDocument>;
  let syncService: SyncService;
  let requestingUser: RequestUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    saleModel = mongoose.model(
      Sale.name,
      SaleSchema,
    ) as unknown as Model<SaleDocument>;
    shiftModel = mongoose.model(
      Shift.name,
      ShiftSchema,
    ) as unknown as Model<ShiftDocument>;
    productModel = mongoose.model(
      Product.name,
      ProductSchema,
    ) as unknown as Model<ProductDocument>;
    inventoryModel = mongoose.model(
      Inventory.name,
      InventorySchema,
    ) as unknown as Model<InventoryDocument>;
    counterModel = mongoose.model(
      Counter.name,
      CounterSchema,
    ) as unknown as Model<CounterDocument>;

    const counterService = new CounterService(counterModel);
    const productsService = new ProductsService(productModel);
    const inventoryService = new InventoryService(inventoryModel);
    const settingsServiceStub = {
      getAll: () => SETTINGS,
    } as unknown as SettingsService;
    // Never invoked in these tests (only reached when a line discount
    // exceeds maxCashierDiscountPercent, and none of these sales discount).
    const abilityFactoryStub = {} as CaslAbilityFactory;
    const managerPinServiceStub = {} as ManagerPinService;

    const salesService = new SalesService(
      saleModel,
      shiftModel,
      counterService,
      productsService,
      inventoryService,
      settingsServiceStub,
      abilityFactoryStub,
      managerPinServiceStub,
    );
    syncService = new SyncService(salesService);
    requestingUser = {
      id: '',
      email: 'cashier@test.local',
      role: {},
    } as unknown as RequestUser;
  }, MONGO_STARTUP_TIMEOUT);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  let productId: Types.ObjectId;
  let cashierId: Types.ObjectId;
  let openShiftId: string;

  beforeEach(async () => {
    await Promise.all([
      saleModel.deleteMany({}),
      shiftModel.deleteMany({}),
      productModel.deleteMany({}),
      inventoryModel.deleteMany({}),
      counterModel.deleteMany({}),
    ]);

    cashierId = new Types.ObjectId();
    requestingUser = { ...requestingUser, id: cashierId.toString() };

    const product = await productModel.create({
      sku: 'SKU-1',
      name: 'Test Product',
      categoryId: new Types.ObjectId(),
      unitsOfMeasure: [
        {
          uom: 'piece',
          conversionFactor: 1,
          costPrice: 100,
          sellPrice: 500,
          isBaseUnit: true,
        },
      ],
      isTaxable: false,
    });
    productId = product._id;

    await inventoryModel.create({
      productId,
      branchId: 'main',
      qtyOnHand: 10,
      qtyReserved: 0,
      avgCost: 100,
    });

    const shift = await shiftModel.create({
      shiftNo: `SHIFT-${Date.now()}`,
      terminalId: 'terminal-1',
      branchId: 'main',
      cashierId,
      openingFloat: 0,
      status: 'open',
    });
    openShiftId = shift._id.toString();
  });

  function saleEvent(overrides: {
    clientEventId: string;
    idempotencyKey: string;
    qty: number;
    shiftId?: string;
    terminalId?: string;
  }) {
    return {
      clientEventId: overrides.clientEventId,
      type: 'sale.create' as const,
      payload: {
        idempotencyKey: overrides.idempotencyKey,
        terminalId: overrides.terminalId ?? 'terminal-1',
        branchId: 'main',
        shiftId: overrides.shiftId ?? openShiftId,
        lines: [
          {
            productId: productId.toString(),
            uom: 'piece',
            qty: overrides.qty,
            discount: 0,
          },
        ],
        payments: [{ method: 'cash' as const, amount: overrides.qty * 500 }],
      },
    };
  }

  it('replays a new event as applied, and a repeat of the same idempotencyKey as duplicate', async () => {
    const event = saleEvent({
      clientEventId: 'evt-1',
      idempotencyKey: 'idem-1',
      qty: 2,
    });

    const [first] = await syncService.pushEvents(
      [event],
      cashierId.toString(),
      requestingUser,
    );
    expect(first.status).toBe('applied');
    expect(first.saleId).toBeDefined();

    const [second] = await syncService.pushEvents(
      [event],
      cashierId.toString(),
      requestingUser,
    );
    expect(second.status).toBe('duplicate');
    expect(second.saleId).toBe(first.saleId);

    const sales = await saleModel.find({}).exec();
    expect(sales).toHaveLength(1);
  });

  it('forces a genuine stockout through and flags it for manager review', async () => {
    const event = saleEvent({
      clientEventId: 'evt-2',
      idempotencyKey: 'idem-2',
      qty: 999,
    });

    const [result] = await syncService.pushEvents(
      [event],
      cashierId.toString(),
      requestingUser,
    );
    expect(result.status).toBe('flagged');

    const sale = await saleModel.findById(result.saleId).exec();
    expect(sale?.needsManagerReview).toBe(true);

    const inventory = await inventoryModel
      .findOne({ productId, branchId: 'main' })
      .exec();
    expect(inventory?.qtyOnHand).toBeLessThan(0);
  });

  it('fails a replay against a shift that no longer matches, without creating a sale', async () => {
    const event = saleEvent({
      clientEventId: 'evt-3',
      idempotencyKey: 'idem-3',
      qty: 1,
      shiftId: new Types.ObjectId().toString(),
    });

    const [result] = await syncService.pushEvents(
      [event],
      cashierId.toString(),
      requestingUser,
    );
    expect(result.status).toBe('failed');
    expect(result.saleId).toBeUndefined();

    const sales = await saleModel.find({}).exec();
    expect(sales).toHaveLength(0);
  });
});
