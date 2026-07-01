import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtClaims } from '@onepos/shared-types';
import { UsersService } from '../../users/users.service';
import { RoleDocument } from '../../roles/schemas/role.schema';
import { RequestUser } from '../../../common/types/request-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtClaims): Promise<RequestUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.roleId as unknown as RoleDocument, // populated by findById
    };
  }
}
