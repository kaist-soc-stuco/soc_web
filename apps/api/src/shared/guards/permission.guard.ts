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
 * @see {import("../../features/auth/guards").RequirePermissions}
 */
export const RequirePermission = (permission: number) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/**
 * 권한 비트 상수.
 * @deprecated `import { Permissions } from "@soc/contracts"` 를 사용하세요.
 * 호환을 위해 유지되며, 값은 Permissions 래퍼에서 가져옵니다.
 */
export const PermissionFlags = {
  WRITE_OFFICIAL: Permissions.WRITE_OFFICIAL,
  WRITE_LAB: Permissions.WRITE_LAB,
  WRITE_REPLY: Permissions.WRITE_REPLY,
  MANAGE_SURVEY: Permissions.MANAGE_SURVEY,
  MANAGE_FINANCE: Permissions.MANAGE_FINANCE,
  MANAGE_SITE_CONTENT: Permissions.MANAGE_SITE_CONTENT,
  MANAGE_CALENDAR: Permissions.MANAGE_CALENDAR,
  MANAGE_CONTACTS: Permissions.MANAGE_CONTACTS,
  MANAGE_USERS: Permissions.MANAGE_USERS,
  MODERATE_CONTENT: Permissions.MODERATE_CONTENT,
  MANAGE_BOARDS: Permissions.MANAGE_BOARDS,
  SEND_BULK_EMAIL: Permissions.SEND_BULK_EMAIL,
  VIEW_AUDIT_LOG: Permissions.VIEW_AUDIT_LOG,
  MANAGE_ROLES: Permissions.MANAGE_ROLES,
  MANAGE_VOTE: Permissions.MANAGE_VOTE,
  SUPER_ADMIN: Permissions.SUPER_ADMIN,
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
