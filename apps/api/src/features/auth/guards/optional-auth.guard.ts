import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { isExpired } from "@soc/shared";

import { UsersService } from "../../users/users.service";
import { AuthSessionRepository } from "../auth-session.repository";
import { AUTH_SESSION_COOKIE_NAME } from "../auth.tokens";

interface AuthenticatedRequest {
  cookies?: Record<string, string | undefined>;
  user?: { id: string; permission: number; roleGroupIds?: number[] };
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const sessionId = request.cookies?.[AUTH_SESSION_COOKIE_NAME];

    if (!sessionId) return true;

    const session = await this.authSessionRepository.findBySessionId(sessionId);

    if (
      !session ||
      session.mode !== "persisted" ||
      !session.userId ||
      session.revoked ||
      isExpired(session.expiresAt)
    ) {
      return true;
    }

    const user = await this.usersService.findById(session.userId);
    if (user?.isActive && !(await this.usersService.isUserRestricted(user.userId))) {
      request.user = {
        id: user.userId,
        permission:
          await this.usersService.resolvePermissionBitmaskByUserId(user.userId),
        // Missing role-group support must not grant access to mapped boards.
        roleGroupIds:
          typeof this.usersService.listActiveRoleGroupIds === "function"
            ? await this.usersService.listActiveRoleGroupIds(user.userId)
            : [],
      };
    }

    return true;
  }
}
