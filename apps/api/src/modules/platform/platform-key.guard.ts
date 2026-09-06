import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// Guards the platform-admin console (/platform/*). Auth is a single shared
// platform key sent as the `x-platform-key` header — NOT a tenant user login.
// Fails closed: if PLATFORM_ADMIN_KEY is unset, every request is rejected.
@Injectable()
export class PlatformKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = process.env.PLATFORM_ADMIN_KEY;
    const provided = req.headers['x-platform-key'];
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Invalid platform key');
    }
    return true;
  }
}
