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
const ANY_PERMISSION_BITS_KEY = Symbol("anyPermissionBits");

@Injectable()
export class PermissionBitsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredBits = this.reflector.getAllAndOverride<number[] | undefined>(
      REQUIRED_PERMISSION_BITS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyBits = this.reflector.getAllAndOverride<number[] | undefined>(
      ANY_PERMISSION_BITS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if ((!requiredBits || requiredBits.length === 0) && (!anyBits || anyBits.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; permission: number };
    }>();

    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }

    const userMask = request.user.permission ?? 0;

    if (requiredBits && requiredBits.length > 0 && !Permissions.has(userMask, ...requiredBits)) {
      throw new ForbiddenException("insufficient_permission");
    }

    if (anyBits && anyBits.length > 0 && !Permissions.hasAny(userMask, ...anyBits)) {
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

export function RequireAnyPermissions(...bits: number[]) {
  return applyDecorators(
    SetMetadata(ANY_PERMISSION_BITS_KEY, bits),
    UseGuards(AuthGuard, PermissionBitsGuard),
  );
}
