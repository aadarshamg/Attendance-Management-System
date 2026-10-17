import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload, RequestUser } from './jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  /**
   * Worker tokens live for months, so the token is only trusted for identity:
   * role, site and active state are re-read on every request. That way a
   * deactivation, PIN reset or site move takes effect immediately.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        assignedSiteId: true,
        name: true,
        employeeCode: true,
        isActive: true,
        sessionVersion: true,
      },
    });
    if (!user || !user.isActive || user.sessionVersion !== (payload.sv ?? 0)) {
      throw new UnauthorizedException('Session expired');
    }
    return {
      id: user.id,
      role: user.role,
      assignedSiteId: user.assignedSiteId,
      name: user.name,
      employeeCode: user.employeeCode,
    };
  }
}
