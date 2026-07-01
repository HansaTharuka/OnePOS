import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SystemRole } from '@onepos/shared-types';
import { UsersService } from '../../modules/users/users.service';
import { RoleDocument } from '../../modules/roles/schemas/role.schema';

const MANAGER_TIER_ROLE_NAMES: string[] = [
  SystemRole.MANAGER,
  SystemRole.ADMIN,
  SystemRole.SUPER_ADMIN,
];

/**
 * Verifies a manager-PIN step-up (discount override, void, paid-out/drop)
 * against any manager/admin/super_admin-tier user's PIN — not a specific
 * one, since any manager on shift can authorize another cashier's request.
 */
@Injectable()
export class ManagerPinService {
  constructor(private readonly usersService: UsersService) {}

  async verifyAndGetApprover(
    pin: string,
  ): Promise<{ id: string; name: string }> {
    const candidates = await this.usersService.findManagerPinCandidates();

    for (const candidate of candidates) {
      const role = candidate.roleId as unknown as RoleDocument;
      if (!MANAGER_TIER_ROLE_NAMES.includes(role.name)) continue;

      const valid = await this.usersService.verifyPin(candidate, pin);
      if (valid) {
        return { id: candidate._id.toString(), name: candidate.name };
      }
    }

    throw new UnauthorizedException('Invalid manager PIN');
  }
}
