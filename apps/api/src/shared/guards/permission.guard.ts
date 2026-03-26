import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

const REQUIRED_PERMISSION_KEY = "requiredPermission";

export const RequirePermission = (permission: number) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

export const PermissionFlags = {
  BOARD_STUDENT_COUNCIL_WRITE: 1,
  BOARD_HOC_PROMO_ESCAMP_WRITE: 2,
  BOARD_LAB_WRITE: 4,
  BOARD_SUGGESTION_REPLY: 8,
  BOARD_QNA_OFFICIAL_WRITE: 16,
  TUITION_MANAGE: 32,
  SURVEY_MANAGE: 64,
  POST_DELETE: 128,
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

    const grantedPermission = request.user.permission ?? 0;

    if ((grantedPermission & requiredPermission) !== requiredPermission) {
      throw new ForbiddenException("insufficient_permission");
    }

    return true;
  }
}
