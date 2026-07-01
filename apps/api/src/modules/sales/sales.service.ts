import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  CaslAction,
  CaslSubject,
  CreateSaleDto,
  CreateSaleLineDto,
  ParkSaleDto,
  ReceiptDto,
  VoidSaleDto,
} from '@onepos/shared-types';
import { CounterService } from '../../common/counters/counter.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { ManagerPinService } from '../../common/manager-pin/manager-pin.service';
import type { RequestUser } from '../../common/types/request-user';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { SettingsService } from '../settings/settings.service';
import { Shift, ShiftDocument } from '../shifts/schemas/shift.schema';
import { Sale, SaleDocument, SaleLine } from './schemas/sale.schema';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

interface ResolvedLines {
  lines: SaleLine[];
  baseQties: number[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Shift.name) private readonly shiftModel: Model<ShiftDocument>,
    private readonly counterService: CounterService,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly settingsService: SettingsService,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly managerPinService: ManagerPinService,
  ) {}

  /**
   * Validates/resolves product+uom and computes totals — no writes, so a bad
   * line fails cheaply with nothing to undo. Shared by `create()` and
   * `park()`.
   */
  private async resolveLines(
    lineDtos: CreateSaleLineDto[],
  ): Promise<ResolvedLines> {
    const settings = this.settingsService.getAll();

    const lines: SaleLine[] = [];
    const baseQties: number[] = [];
    for (const lineDto of lineDtos) {
      const product = await this.productsService.findById(lineDto.productId);
      const uomEntry = this.productsService.getUomEntry(product, lineDto.uom);

      const lineSubtotal = uomEntry.sellPrice * lineDto.qty - lineDto.discount;
      const taxAmount = product.isTaxable
        ? Math.round((lineSubtotal * settings.defaultTaxRatePercent) / 100)
        : 0;

      lines.push({
        productId: product._id,
        uom: lineDto.uom,
        qty: lineDto.qty,
        unitPrice: uomEntry.sellPrice,
        discount: lineDto.discount,
        taxAmount,
        lineTotal: lineSubtotal + taxAmount,
      });
      baseQties.push(lineDto.qty * uomEntry.conversionFactor);
    }

    const subtotal = lines.reduce(
      (sum, l) => sum + l.unitPrice * l.qty - l.discount,
      0,
    );
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const grandTotal = subtotal + taxTotal;

    return { lines, baseQties, subtotal, taxTotal, grandTotal };
  }

  async create(
    dto: CreateSaleDto,
    cashierId: string,
    requestingUser: RequestUser,
  ): Promise<SaleDocument> {
    const existing = await this.saleModel
      .findOne({ idempotencyKey: dto.idempotencyKey })
      .exec();
    if (existing) return existing;

    const { lines, baseQties, subtotal, taxTotal, grandTotal } =
      await this.resolveLines(dto.lines);

    // The sale must be rung up against an open shift for this cashier and
    // terminal — otherwise there's no till to reconcile it against later.
    const shift = await this.shiftModel.findById(dto.shiftId).exec();
    if (
      !shift ||
      shift.status !== 'open' ||
      shift.cashierId.toString() !== cashierId ||
      shift.terminalId !== dto.terminalId
    ) {
      throw new ConflictException('No open shift for this terminal.');
    }

    // Discount-override check: a cashier-tier line discount above the
    // configured cap needs either an APPROVE-capable requester or a valid
    // manager PIN.
    const settings = this.settingsService.getAll();
    const exceedsDiscountCap = lines.some((line) => {
      const baseAmount = line.unitPrice * line.qty;
      if (baseAmount <= 0) return false;
      const discountPercent = (line.discount / baseAmount) * 100;
      return discountPercent > settings.maxCashierDiscountPercent;
    });

    let overrideApprovedBy: string | undefined;
    if (exceedsDiscountCap) {
      const ability = this.abilityFactory.createForUser(requestingUser);
      if (!ability.can(CaslAction.APPROVE, CaslSubject.SALE)) {
        if (!dto.managerOverridePin) {
          throw new BadRequestException(
            'Manager approval required for this discount.',
          );
        }
        const approver = await this.managerPinService.verifyAndGetApprover(
          dto.managerOverridePin,
        );
        overrideApprovedBy = approver.id;
      }
    }

    // Payment validation — split/multi tender, cash covers whatever the
    // non-cash methods don't.
    const cashTotal = dto.payments
      .filter((p) => p.method === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);
    const nonCashTotal = dto.payments
      .filter((p) => p.method !== 'cash')
      .reduce((sum, p) => sum + p.amount, 0);
    if (nonCashTotal > grandTotal) {
      throw new BadRequestException('Non-cash tender cannot exceed total.');
    }
    const amountDue = grandTotal - nonCashTotal;
    if (cashTotal < amountDue) {
      throw new BadRequestException('Insufficient payment.');
    }
    const changeGiven = cashTotal - amountDue;

    // Pass 2: decrement stock per line. If a later line's guard fails (e.g.
    // insufficient stock under the "block" policy), compensate by
    // re-incrementing the lines already decremented earlier in this request.
    const baseQtiesDecremented: { productId: string; baseQty: number }[] = [];
    try {
      for (let i = 0; i < dto.lines.length; i++) {
        const productId = dto.lines[i].productId;
        const baseQty = baseQties[i];
        await this.inventoryService.decrementStockAtomic(
          productId,
          dto.branchId,
          baseQty,
          settings.negativeStockPolicy,
        );
        baseQtiesDecremented.push({ productId, baseQty });
      }
    } catch (err) {
      for (const decremented of baseQtiesDecremented) {
        await this.inventoryService.reverseDecrement(
          decremented.productId,
          dto.branchId,
          decremented.baseQty,
        );
      }
      throw err;
    }

    const seq = await this.counterService.getNextSequence('sales');
    const orderNo = `${settings.invoicePrefix}-${seq}`;

    try {
      return await this.saleModel.create({
        orderNo,
        cashierId,
        terminalId: dto.terminalId,
        branchId: dto.branchId,
        customerId: dto.customerId,
        shiftId: dto.shiftId,
        lines,
        payments: dto.payments,
        changeGiven,
        subtotal,
        taxTotal,
        grandTotal,
        status: 'completed',
        idempotencyKey: dto.idempotencyKey,
        overrideApprovedBy,
      });
    } catch (err: unknown) {
      // Rare concurrent double-submit of the same idempotency key — the
      // stock decrement already happened once and must not be re-applied.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === MONGO_DUPLICATE_KEY_ERROR
      ) {
        const winner = await this.saleModel
          .findOne({ idempotencyKey: dto.idempotencyKey })
          .exec();
        if (winner) {
          for (const decremented of baseQtiesDecremented) {
            await this.inventoryService.reverseDecrement(
              decremented.productId,
              dto.branchId,
              decremented.baseQty,
            );
          }
          return winner;
        }
      }
      throw err;
    }
  }

  /** Saves a cart as a draft with no stock/financial impact, to resume later. */
  async park(dto: ParkSaleDto, cashierId: string): Promise<SaleDocument> {
    const { lines, subtotal, taxTotal, grandTotal } = await this.resolveLines(
      dto.lines,
    );

    return this.saleModel.create({
      orderNo: `PARK-${randomUUID()}`,
      cashierId,
      terminalId: dto.terminalId,
      customerId: dto.customerId,
      shiftId: dto.shiftId,
      lines,
      payments: [],
      changeGiven: 0,
      subtotal,
      taxTotal,
      grandTotal,
      status: 'parked',
      idempotencyKey: `park-${randomUUID()}`,
    });
  }

  findParked(requestingUser: RequestUser): Promise<SaleDocument[]> {
    const ability = this.abilityFactory.createForUser(requestingUser);
    if (ability.can(CaslAction.READ, CaslSubject.ALL)) {
      return this.saleModel.find({ status: 'parked' }).exec();
    }
    return this.saleModel
      .find({ status: 'parked', cashierId: requestingUser.id })
      .exec();
  }

  async deleteParked(id: string, requestingUser: RequestUser): Promise<void> {
    const sale = await this.findById(id);
    if (sale.status !== 'parked') {
      throw new ConflictException('Only parked sales can be deleted.');
    }

    const isOwn = sale.cashierId.toString() === requestingUser.id;
    if (!isOwn) {
      const ability = this.abilityFactory.createForUser(requestingUser);
      if (!ability.can(CaslAction.APPROVE, CaslSubject.SALE)) {
        throw new ForbiddenException(
          'You do not have permission to delete this parked sale.',
        );
      }
    }

    await this.saleModel.deleteOne({ _id: id }).exec();
  }

  /**
   * Voids a completed sale and reverses its stock decrement. Deliberately
   * takes no `requestingUser` — the manager PIN itself carries the
   * step-up authority, so any authenticated session (even a Cashier's) can
   * invoke this once a valid manager PIN is supplied (see sales.controller.ts).
   */
  async voidSale(id: string, dto: VoidSaleDto): Promise<SaleDocument> {
    const sale = await this.findById(id);
    if (sale.status !== 'completed') {
      throw new ConflictException('Only completed sales can be voided.');
    }

    const approver = await this.managerPinService.verifyAndGetApprover(
      dto.managerPin,
    );

    for (const line of sale.lines) {
      const product = await this.productsService.findById(
        line.productId.toString(),
      );
      const uomEntry = this.productsService.getUomEntry(product, line.uom);
      const baseQty = line.qty * uomEntry.conversionFactor;
      await this.inventoryService.reverseDecrement(
        line.productId.toString(),
        sale.branchId,
        baseQty,
      );
    }

    const updated = await this.saleModel
      .findByIdAndUpdate(
        id,
        {
          status: 'voided',
          voidedBy: approver.id,
          voidReason: dto.reason,
        },
        { new: true },
      )
      .exec();
    return updated!;
  }

  findAll() {
    return this.saleModel.find().exec();
  }

  async findById(id: string): Promise<SaleDocument> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) throw new NotFoundException('Sale not found.');
    return sale;
  }

  async getReceipt(id: string): Promise<ReceiptDto> {
    const sale = await this.findById(id);
    const settings = this.settingsService.getAll();

    return {
      businessName: settings.businessName,
      currencySymbol: settings.currencySymbol,
      receiptFooterText: settings.receiptFooterText,
      orderNo: sale.orderNo,
      createdAt: (
        sale as unknown as { createdAt: Date }
      ).createdAt.toISOString(),
      lines: sale.lines.map((l) => ({
        productId: l.productId.toString(),
        uom: l.uom,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        taxAmount: l.taxAmount,
        lineTotal: l.lineTotal,
      })),
      subtotal: sale.subtotal,
      taxTotal: sale.taxTotal,
      grandTotal: sale.grandTotal,
      payments: sale.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      })),
      changeGiven: sale.changeGiven,
    };
  }
}
