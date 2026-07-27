import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_ACCESS_COOKIE_NAME } from '../../features/auth/auth.tokens';

import { AuthGuard } from './auth.guard';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly authGuard: AuthGuard) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!Object.prototype.hasOwnProperty.call(request.cookies ?? {}, AUTH_ACCESS_COOKIE_NAME)) return true;
    return this.authGuard.canActivate(context);
  }
}
