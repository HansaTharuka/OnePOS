import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CaslAction,
  CaslSubject,
  createUserDtoSchema,
  updateUserDtoSchema,
} from '@onepos/shared-types';
import type { CreateUserDto, UpdateUserDto } from '@onepos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAbilityGuard } from '../../common/casl/casl-ability.guard';
import { CheckAbility } from '../../common/casl/check-ability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.USER })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.USER })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.USER })
  create(
    @Body(new ZodValidationPipe(createUserDtoSchema)) body: CreateUserDto,
  ) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.USER })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserDtoSchema)) body: UpdateUserDto,
  ) {
    return this.usersService.update(id, body);
  }
}
