import { CaslAction, CaslSubject, SystemRole } from '@onepos/shared-types';
import { AbilityRule } from './schemas/role.schema';

/**
 * Default role seed data (docs/03-rbac-permissions.md). These run once at
 * bootstrap if the `roles` collection is empty; a Super Admin can add or
 * tune granular rules afterward from the admin UI without a deploy.
 */
export interface RoleSeedDefinition {
  name: SystemRole;
  description: string;
  isSystemRole: true;
  rules: AbilityRule[];
}

const rule = (
  action: CaslAction[],
  subject: CaslSubject[],
  extra: Partial<AbilityRule> = {},
): AbilityRule => ({ action, subject, ...extra });

export const ROLE_SEED_DEFINITIONS: RoleSeedDefinition[] = [
  {
    name: SystemRole.SUPER_ADMIN,
    description: 'Full access, including settings and user/role management.',
    isSystemRole: true,
    rules: [rule([CaslAction.MANAGE], [CaslSubject.ALL])],
  },
  {
    name: SystemRole.ADMIN,
    description:
      'Full operational access, excludes infrastructure-level settings.',
    isSystemRole: true,
    rules: [
      rule([CaslAction.MANAGE], [CaslSubject.ALL]),
      rule([CaslAction.MANAGE], [CaslSubject.SETTINGS], { inverted: true }),
    ],
  },
  {
    name: SystemRole.MANAGER,
    description:
      'Approves overrides/voids/discounts, views reports, manages shifts.',
    isSystemRole: true,
    rules: [
      rule([CaslAction.READ], [CaslSubject.ALL]),
      rule(
        [
          CaslAction.CREATE,
          CaslAction.UPDATE,
          CaslAction.VOID,
          CaslAction.APPROVE,
        ],
        [CaslSubject.SALE, CaslSubject.RETURN, CaslSubject.SHIFT],
      ),
      rule(
        [CaslAction.MANAGE],
        [CaslSubject.PRODUCT, CaslSubject.INVENTORY, CaslSubject.CUSTOMER],
      ),
    ],
  },
  {
    name: SystemRole.CASHIER,
    description: 'Runs the sale flow and own-shift till operations.',
    isSystemRole: true,
    rules: [
      rule(
        [CaslAction.CREATE, CaslAction.READ],
        [CaslSubject.SALE, CaslSubject.CUSTOMER],
      ),
      rule([CaslAction.UPDATE], [CaslSubject.SALE], {
        conditions: { cashierId: '$user.id' },
      }),
      rule([CaslAction.READ], [CaslSubject.PRODUCT, CaslSubject.INVENTORY]),
      rule([CaslAction.CREATE, CaslAction.UPDATE], [CaslSubject.SHIFT], {
        conditions: { cashierId: '$user.id' },
      }),
    ],
  },
  {
    name: SystemRole.INVENTORY_CLERK,
    description:
      'Products, stock, purchase orders, GRNs — no sales/financial access.',
    isSystemRole: true,
    rules: [
      rule(
        [CaslAction.MANAGE],
        [
          CaslSubject.PRODUCT,
          CaslSubject.INVENTORY,
          CaslSubject.PURCHASE_ORDER,
          CaslSubject.GRN,
        ],
      ),
    ],
  },
  {
    name: SystemRole.ACCOUNTANT,
    description:
      'Read-only across sales/financial reports, no operational writes.',
    isSystemRole: true,
    rules: [
      rule(
        [CaslAction.READ],
        [
          CaslSubject.SALE,
          CaslSubject.RETURN,
          CaslSubject.REPORT,
          CaslSubject.AUDIT_LOG,
        ],
      ),
    ],
  },
];
