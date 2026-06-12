import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permissions } from "@soc/contracts";

import { AuthGuard } from "./auth.guard";

const REQUIRED_PERMISSION_BITS_KEY = Symbol("requiredPermissionBits");

@Injectable()
export class PermissionBitsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredBits = this.reflector.getAllAndOverride<number[] | undefined>(
      REQUIRED_PERMISSION_BITS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredBits || requiredBits.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; permission: number };
    }>();

    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }

    const userMask = request.user.permission ?? 0;

    if (!Permissions.has(userMask, ...requiredBits)) {
      throw new ForbiddenException("insufficient_permission");
    }

    return true;
  }
}

export function RequirePermissions(...bits: number[]) {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSION_BITS_KEY, bits),
    UseGuards(AuthGuard, PermissionBitsGuard),
  );
}
