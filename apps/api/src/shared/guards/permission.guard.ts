import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permissions } from "@soc/contracts";

const REQUIRED_PERMISSION_KEY = "requiredPermission";

/**
 * @deprecated RequirePermissions 데코레이터를 사용하세요.
 * @see {import("../decorators/require-permissions.decorator").RequirePermissions}
 */
export const RequirePermission = (permission: number) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/**
 * 권한 비트 상수.
 * @deprecated `import { Permissions } from "@soc/contracts"` 를 사용하세요.
 * 호환을 위해 유지되며, 값은 Permissions 래퍼에서 가져옵니다.
 */
export const PermissionFlags = {
  WRITE_NOTICE: Permissions.WRITE_NOTICE,
  WRITE_GENERAL: Permissions.WRITE_GENERAL,
  WRITE_REPLY: Permissions.WRITE_REPLY,
  MANAGE_SURVEY: Permissions.MANAGE_SURVEY,
  MANAGE_FINANCE: Permissions.MANAGE_FINANCE,
  MANAGE_CONTENT: Permissions.MANAGE_CONTENT,
  MANAGE_TOOL: Permissions.MANAGE_TOOL,
  MODERATOR: Permissions.MODERATOR,
  ADMIN: Permissions.ADMIN,
} as const;

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<number>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission || requiredPermission <= 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: {
        id: string;
        permission: number;
      };
    }>();

    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }

    if (!Permissions.has(request.user.permission ?? 0, requiredPermission)) {
      throw new ForbiddenException("insufficient_permission");
    }

    return true;
  }
}
