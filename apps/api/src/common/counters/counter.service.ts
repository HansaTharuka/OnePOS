import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter, CounterDocument } from './counter.schema';

/** Atomic sequence generator for human-readable order/GRN numbers. */
@Injectable()
export class CounterService {
  constructor(
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  async getNextSequence(name: string): Promise<number> {
    const doc = await this.counterModel
      .findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      )
      .exec();
    return doc.seq;
  }
}
