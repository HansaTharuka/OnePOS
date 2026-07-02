import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { CaslModule } from '../../common/casl/casl.module';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [SalesModule, CaslModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
