import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { ROLE_SEED_DEFINITIONS } from './roles.seed';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  /** Seed default roles once, on first boot against an empty collection. */
  async onModuleInit(): Promise<void> {
    const existingCount = await this.roleModel.countDocuments();
    if (existingCount > 0) return;

    await this.roleModel.insertMany(ROLE_SEED_DEFINITIONS);
    this.logger.log(`Seeded ${ROLE_SEED_DEFINITIONS.length} default roles.`);
  }

  findAll() {
    return this.roleModel.find().exec();
  }

  findById(id: string) {
    return this.roleModel.findById(id).exec();
  }

  findByName(name: string) {
    return this.roleModel.findOne({ name }).exec();
  }
}
