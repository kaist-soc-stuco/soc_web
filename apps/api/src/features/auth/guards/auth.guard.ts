import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { isExpired } from "@soc/shared";

import { UsersService } from "../../users/users.service";
import { AuthEligibilityService } from "../auth-eligibility.service";
import { AuthSessionRepository } from "../auth-session.repository";
import { AUTH_SESSION_COOKIE_NAME } from "../auth.tokens";

interface AuthenticatedRequest {
  cookies?: Record<string, string | undefined>;
  user?: {
    id: string;
    permission: number;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly usersService: UsersService,
    private readonly authEligibilityService: AuthEligibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const sessionId = request.cookies?.[AUTH_SESSION_COOKIE_NAME];

    if (!sessionId) {
      throw new UnauthorizedException("session_cookie_missing");
    }

    const session = await this.authSessionRepository.findBySessionId(sessionId);

    if (
      !session ||
      session.mode !== "persisted" ||
      !session.userId ||
      session.revoked ||
      isExpired(session.expiresAt)
    ) {
      throw new UnauthorizedException("session_invalid");
    }

    const user = await this.usersService.findById(session.userId);

    if (!user) {
      throw new UnauthorizedException("user_not_found");
    }

    if (!user.isActive) {
      await this.authSessionRepository.revoke(sessionId);
      throw new UnauthorizedException("account_expired");
    }

    if (!this.authEligibilityService.isEligibleUser(user)) {
      await this.usersService.expireAccount(
        user.userId,
        "department_not_eligible",
      );
      await this.authSessionRepository.revoke(sessionId);
      throw new UnauthorizedException("department_not_eligible");
    }

    request.user = {
      id: user.userId,
      permission:
        await this.usersService.resolvePermissionBitmaskByUserId(user.userId),
    };

    return true;
  }
}
