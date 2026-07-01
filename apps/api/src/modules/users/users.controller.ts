import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { zodApiSchema } from '../../common/swagger/zod-schema';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.USER })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @CheckAbility({ action: CaslAction.READ, subject: CaslSubject.USER })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiBody({ schema: zodApiSchema(createUserDtoSchema) })
  @CheckAbility({ action: CaslAction.CREATE, subject: CaslSubject.USER })
  create(
    @Body(new ZodValidationPipe(createUserDtoSchema)) body: CreateUserDto,
  ) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiBody({ schema: zodApiSchema(updateUserDtoSchema) })
  @CheckAbility({ action: CaslAction.UPDATE, subject: CaslSubject.USER })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserDtoSchema)) body: UpdateUserDto,
  ) {
    return this.usersService.update(id, body);
  }
}
