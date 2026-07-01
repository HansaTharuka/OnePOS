import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from '@onepos/shared-types';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const pinHash = dto.pinCode
      ? await bcrypt.hash(dto.pinCode, SALT_ROUNDS)
      : undefined;

    return this.userModel.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      pinHash,
      roleId: dto.roleId,
      isActive: dto.isActive,
    });
  }

  findAll() {
    return this.userModel.find().populate('roleId').exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).populate('roleId').exec();
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  /** Includes the password hash — for auth-flow use only, never returned to a client. */
  findByEmailWithSecrets(email: string) {
    return this.userModel
      .findOne({ email })
      .select('+passwordHash +pinHash')
      .populate('roleId')
      .exec();
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async verifyPassword(
    user: UserDocument,
    plaintext: string,
  ): Promise<boolean> {
    return bcrypt.compare(plaintext, user.passwordHash);
  }

  async verifyPin(user: UserDocument, plaintextPin: string): Promise<boolean> {
    if (!user.pinHash) return false;
    return bcrypt.compare(plaintextPin, user.pinHash);
  }
}
