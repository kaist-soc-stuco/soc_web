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
import { AuthGuard } from "../guards/auth.guard";

// ─── Metadata key ────────────────────────────────────────────────────────────

const REQUIRED_PERMISSION_BITS_KEY = Symbol("requiredPermissionBits");

// ─── Guard ───────────────────────────────────────────────────────────────────

/**
 * AuthGuard가 `request.user.permission`을 세팅한 뒤에 실행되어야 합니다.
 * metadata에 저장된 bit 값을 읽어 AND 검사를 수행합니다.
 */
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

// ─── Decorator ───────────────────────────────────────────────────────────────

/**
 * 핸들러(또는 컨트롤러)에 필요한 권한 비트를 선언적으로 지정합니다.
 * AuthGuard 뒤에 PermissionBitsGuard를 자동으로 적용합니다.
 *
 * @example
 * ```ts
 * import { Permissions } from "@soc/contracts";
 *
 * @Post()
 * @RequirePermissions(Permissions.ADMIN)
 * async createRoleGroup(...) { ... }
 *
 * // 복수 권한 (AND — 모두 필요)
 * @RequirePermissions(Permissions.MANAGE_SURVEY, Permissions.MODERATOR)
 * async dangerousAction(...) { ... }
 * ```
 */
export function RequirePermissions(...bits: number[]) {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSION_BITS_KEY, bits),
    UseGuards(AuthGuard, PermissionBitsGuard),
  );
}
