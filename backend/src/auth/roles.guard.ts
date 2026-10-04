import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AccessTokenPayload } from './auth.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true; // endpoint tidak butuh role tertentu (cukup login)
    }

    const { user } = context.switchToHttp().getRequest<{
      user?: AccessTokenPayload;
    }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Anda tidak punya akses ke resource ini');
    }
    return true;
  }
}
