import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_ABILITY_KEY,
  RequiredAbilityRule,
} from './check-ability.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Enforces @CheckAbility() route requirements against the current user's
 * persisted role rules. Runs after JwtAuthGuard, which attaches req.user.
 */
@Injectable()
export class CaslAbilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirements = this.reflector.get<RequiredAbilityRule[] | undefined>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    );
    if (!requirements || requirements.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user?.role) {
      throw new ForbiddenException(
        'No role context available for this request.',
      );
    }

    const ability = this.abilityFactory.createForUser({
      id: user.id,
      role: user.role,
    });

    const allowed = requirements.every((req) =>
      ability.can(req.action, req.subject),
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    return true;
  }
}
