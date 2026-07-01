import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { CaslAction, CaslSubject } from '@onepos/shared-types';
import { RoleDocument } from '../../modules/roles/schemas/role.schema';

export type AppAbility = MongoAbility<[CaslAction, CaslSubject]>;

export interface AbilityUserContext {
  id: string;
  role: RoleDocument;
}

/**
 * Builds a CASL ability from a user's persisted role rules.
 * Rules are data (docs/03-rbac-permissions.md) — a new permission is a new
 * row in the `roles` collection, not a code change.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AbilityUserContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    for (const rule of user.role.rules) {
      // Rules are persisted, data-driven role permissions (docs/03-rbac-permissions.md) —
      // their conditions shape isn't statically known per subject, hence the `any` cast.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const conditions = this.interpolateConditions(
        rule.conditions,
        user,
      ) as any;
      if (rule.inverted) {
        cannot(rule.action, rule.subject, conditions);
      } else {
        can(rule.action, rule.subject, conditions);
      }
    }

    return build();
  }

  /** Resolves placeholder tokens like "$user.id" (see roles.seed.ts) against the current user. */
  private interpolateConditions(
    conditions: Record<string, unknown> | undefined,
    user: AbilityUserContext,
  ): Record<string, unknown> | undefined {
    if (!conditions) return undefined;

    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(conditions)) {
      resolved[key] = value === '$user.id' ? user.id : value;
    }
    return resolved;
  }
}
