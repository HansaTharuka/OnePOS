import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthTokenResponse,
  JwtClaims,
  LoginDto,
  SetupDto,
  SetupStatusDto,
  SystemRole,
} from '@onepos/shared-types';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SettingsService } from '../settings/settings.service';
import { RoleDocument } from '../roles/schemas/role.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly settingsService: SettingsService,
    private readonly jwtService: JwtService,
  ) {}

  /** Whether a fresh install still needs its first admin account created. */
  async getSetupStatus(): Promise<SetupStatusDto> {
    const userCount = await this.usersService.count();
    return { needsSetup: userCount === 0 };
  }

  /**
   * Creates the first admin account on a fresh install. Re-checks the user
   * count itself (rather than trusting the caller already checked
   * getSetupStatus()) so this can't be replayed once real users exist —
   * there's no auth guard possible here, this is the only way to get a
   * first JWT on an empty database (see docs/dev-playbook/phase4.txt).
   */
  async setup(dto: SetupDto): Promise<AuthTokenResponse> {
    const userCount = await this.usersService.count();
    if (userCount > 0) {
      throw new ConflictException('Setup has already been completed.');
    }

    const superAdminRole = await this.rolesService.findByName(
      SystemRole.SUPER_ADMIN,
    );
    if (!superAdminRole) {
      throw new ConflictException(
        'Super Admin role is not seeded yet — try again in a moment.',
      );
    }

    await this.settingsService.update({ businessName: dto.businessName });
    await this.usersService.create({
      name: dto.adminName,
      email: dto.adminEmail,
      password: dto.adminPassword,
      roleId: superAdminRole._id.toString(),
      isActive: true,
    });

    return this.login({ email: dto.adminEmail, password: dto.adminPassword });
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordValid = await this.usersService.verifyPassword(
      user,
      dto.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const role = user.roleId as unknown as RoleDocument;
    const claims: JwtClaims = {
      sub: user._id.toString(),
      email: user.email,
      roleId: role._id.toString(),
      roleName: role.name,
    };

    const accessToken = this.jwtService.sign(claims);
    const decoded = this.jwtService.decode<{ exp: number; iat: number }>(
      accessToken,
    );
    const expiresIn = decoded.exp - decoded.iat;

    return {
      accessToken,
      expiresIn,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        roleName: role.name,
      },
    };
  }
}
