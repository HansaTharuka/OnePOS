import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenResponse, JwtClaims, LoginDto } from '@onepos/shared-types';
import { UsersService } from '../users/users.service';
import { RoleDocument } from '../roles/schemas/role.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

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
