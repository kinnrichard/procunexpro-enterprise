import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'enterprise-jwt-secret-change-in-production',
    });
  }

  async validate(payload: { sub: string; tenantId: string; role: string; username: string }) {
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      username: payload.username,
    };
  }
}
