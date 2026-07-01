import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslAbilityGuard } from './casl-ability.guard';

@Module({
  providers: [CaslAbilityFactory, CaslAbilityGuard],
  exports: [CaslAbilityFactory, CaslAbilityGuard],
})
export class CaslModule {}
