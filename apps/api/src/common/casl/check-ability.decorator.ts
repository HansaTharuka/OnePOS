import { SetMetadata } from '@nestjs/common';
import { CaslAction, CaslSubject } from '@onepos/shared-types';

export interface RequiredAbilityRule {
  action: CaslAction;
  subject: CaslSubject;
}

export const CHECK_ABILITY_KEY = 'check_ability';

/** Declares the (action, subject) pairs a route requires. Enforced by CaslAbilityGuard. */
export const CheckAbility = (...requirements: RequiredAbilityRule[]) =>
  SetMetadata(CHECK_ABILITY_KEY, requirements);
