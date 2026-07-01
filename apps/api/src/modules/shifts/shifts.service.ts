import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CashDrawerMovementDto,
  CaslAction,
  CaslSubject,
  CloseShiftDto,
  OpenShiftDto,
} from '@onepos/shared-types';
import { CounterService } from '../../common/counters/counter.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { ManagerPinService } from '../../common/manager-pin/manager-pin.service';
import type { RequestUser } from '../../common/types/request-user';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { Shift, ShiftDocument } from './schemas/shift.schema';
import {
  CashDrawerMovement,
  CashDrawerMovementDocument,
} from './schemas/cash-drawer-movement.schema';

/** Movement types summed into `closeShift`'s expected-cash formula (opening excluded — it's the starting float, not a delta). */
const NON_OPENING_MOVEMENT_TYPES = ['paid-in', 'paid-out', 'drop'];

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name)
    private readonly shiftModel: Model<ShiftDocument>,
    @InjectModel(CashDrawerMovement.name)
    private readonly movementModel: Model<CashDrawerMovementDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    private readonly counterService: CounterService,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly managerPinService: ManagerPinService,
  ) {}

  async openShift(
    dto: OpenShiftDto,
    cashierId: string,
  ): Promise<ShiftDocument> {
    const existingOpen = await this.shiftModel
      .findOne({ cashierId, status: 'open' })
      .exec();
    if (existingOpen) {
      throw new ConflictException(
        'This cashier already has an open shift. Close it before opening another.',
      );
    }

    const seq = await this.counterService.getNextSequence('shifts');
    const shift = await this.shiftModel.create({
      shiftNo: `SHIFT-${seq}`,
      terminalId: dto.terminalId,
      branchId: dto.branchId,
      cashierId,
      openingFloat: dto.openingFloat,
      status: 'open',
    });

    await this.movementModel.create({
      shiftId: shift._id,
      type: 'opening',
      amount: dto.openingFloat,
      recordedBy: cashierId,
    });

    return shift;
  }

  async closeShift(
    shiftId: string,
    dto: CloseShiftDto,
    requestingUser: RequestUser,
  ): Promise<ShiftDocument> {
    const shift = await this.findById(shiftId);
    if (shift.status !== 'open') {
      throw new ConflictException('This shift is already closed.');
    }

    const isOwnShift = shift.cashierId.toString() === requestingUser.id;
    if (!isOwnShift) {
      const ability = this.abilityFactory.createForUser(requestingUser);
      if (!ability.can(CaslAction.APPROVE, CaslSubject.SHIFT)) {
        throw new ForbiddenException(
          'You do not have permission to close this shift.',
        );
      }
    }

    const [cashSalesAgg, movementTotals] = await Promise.all([
      this.saleModel.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            shiftId: shift._id.toString(),
            status: 'completed',
          },
        },
        { $unwind: '$payments' },
        { $match: { 'payments.method': 'cash' } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      this.movementModel.aggregate<{ _id: string; total: number }>([
        {
          $match: {
            shiftId: shift._id,
            type: { $in: NON_OPENING_MOVEMENT_TYPES },
          },
        },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
    ]);

    const cashSalesTotal = cashSalesAgg[0]?.total ?? 0;
    const totalsByType = new Map(
      movementTotals.map((entry) => [entry._id, entry.total]),
    );
    const paidInTotal = totalsByType.get('paid-in') ?? 0;
    const paidOutTotal = totalsByType.get('paid-out') ?? 0;
    const dropTotal = totalsByType.get('drop') ?? 0;

    const expectedCash =
      shift.openingFloat +
      cashSalesTotal +
      paidInTotal -
      paidOutTotal -
      dropTotal;
    const variance = dto.closingCountedCash - expectedCash;

    shift.status = 'closed';
    shift.closedAt = new Date();
    shift.closingCountedCash = dto.closingCountedCash;
    shift.expectedCash = expectedCash;
    shift.variance = variance;
    await shift.save();
    return shift;
  }

  async recordCashMovement(
    shiftId: string,
    dto: CashDrawerMovementDto,
    requestingUser: RequestUser,
  ): Promise<CashDrawerMovementDocument> {
    const shift = await this.findById(shiftId);
    if (shift.cashierId.toString() !== requestingUser.id) {
      throw new ForbiddenException('This is not your shift.');
    }
    if (shift.status !== 'open') {
      throw new ConflictException('This shift is already closed.');
    }

    let authorizedBy: string | undefined;
    if (dto.type === 'paid-out' || dto.type === 'drop') {
      if (!dto.managerPin) {
        throw new ForbiddenException(
          'Manager approval is required for this cash movement.',
        );
      }
      const approver = await this.managerPinService.verifyAndGetApprover(
        dto.managerPin,
      );
      authorizedBy = approver.id;
    }

    return this.movementModel.create({
      shiftId: shift._id,
      type: dto.type,
      amount: dto.amount,
      reason: dto.reason,
      authorizedBy,
      recordedBy: requestingUser.id,
    });
  }

  findCurrent(
    cashierId: string,
    terminalId: string,
  ): Promise<ShiftDocument | null> {
    return this.shiftModel
      .findOne({ cashierId, terminalId, status: 'open' })
      .exec();
  }

  findAll(requestingUser: RequestUser): Promise<ShiftDocument[]> {
    const ability = this.abilityFactory.createForUser(requestingUser);
    if (ability.can(CaslAction.READ, CaslSubject.ALL)) {
      return this.shiftModel.find().exec();
    }
    return this.shiftModel.find({ cashierId: requestingUser.id }).exec();
  }

  async findById(id: string): Promise<ShiftDocument> {
    const shift = await this.shiftModel.findById(id).exec();
    if (!shift) throw new NotFoundException('Shift not found.');
    return shift;
  }

  findMovements(shiftId: string) {
    return this.movementModel.find({ shiftId }).sort({ createdAt: 1 }).exec();
  }
}
