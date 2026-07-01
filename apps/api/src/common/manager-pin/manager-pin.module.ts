import { Module } from '@nestjs/common';
import { UsersModule } from '../../modules/users/users.module';
import { ManagerPinService } from './manager-pin.service';

@Module({
  imports: [UsersModule],
  providers: [ManagerPinService],
  exports: [ManagerPinService],
})
export class ManagerPinModule {}
