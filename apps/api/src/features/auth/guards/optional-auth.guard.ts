import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { isExpired } from "@soc/shared";

import { UsersService } from "../../users/users.service";
import { AuthSessionRepository } from "../auth-session.repository";
import { AuthSessionService } from "../auth-session.service";
import { AUTH_SESSION_COOKIE_NAME, extractBearerToken } from "../auth.tokens";
import type { TemporaryAccessTokenClaims } from "../auth.types";
import { RequestRateLimitService } from "../../../infrastructure/redis/request-rate-limit.service";

interface AuthenticatedRequest {
  cookies?: Record<string, string | undefined>;
  user?: { id: string; permission: number };
  temporaryUser?: TemporaryAccessTokenClaims;
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly requestRateLimitService: RequestRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const sessionId = request.cookies?.[AUTH_SESSION_COOKIE_NAME];

    if (!sessionId) {
      const accessToken = extractBearerToken(request.headers.authorization);
      if (accessToken) {
        let temporaryUser: TemporaryAccessTokenClaims;
        try {
          temporaryUser =
            this.authSessionService.validateTemporaryAccessToken(accessToken);
        } catch {
          // Optional authentication treats invalid/expired credentials as
          // anonymous; protected routes still use AuthGuard separately.
          return true;
        }
        request.temporaryUser = temporaryUser;
        await this.requestRateLimitService.enforceAuthenticated(
          request,
          temporaryUser.sub,
        );
      }
      return true;
    }

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
    if (user?.isActive) {
      request.user = {
        id: user.userId,
        permission:
          await this.usersService.resolvePermissionBitmaskByUserId(user.userId),
      };
      await this.requestRateLimitService.enforceAuthenticated(request, user.userId);
    }

    return true;
  }
}
