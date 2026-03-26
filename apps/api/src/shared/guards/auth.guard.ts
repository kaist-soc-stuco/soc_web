import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { parse as parseCookieHeader } from "cookie";

import { AuthSessionRepository } from "../../features/auth/auth-session.repository";
import { AUTH_SESSION_COOKIE_NAME } from "../../features/auth/auth.tokens";
import { UsersService } from "../../features/users/users.service";

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieHeader = request.headers.cookie;
    const cookieRaw = Array.isArray(cookieHeader)
      ? cookieHeader.join(";")
      : cookieHeader;

    if (!cookieRaw) {
      throw new UnauthorizedException("session_cookie_missing");
    }

    const cookie = parseCookieHeader(cookieRaw);
    const sessionId = cookie[AUTH_SESSION_COOKIE_NAME];

    if (!sessionId) {
      throw new UnauthorizedException("session_cookie_missing");
    }

    const session = await this.authSessionRepository.findBySessionId(sessionId);

    if (
      !session ||
      session.mode !== "persisted" ||
      !session.userId ||
      session.revoked ||
      session.expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException("session_invalid");
    }

    const user = await this.usersService.findById(session.userId);

    if (!user) {
      throw new UnauthorizedException("user_not_found");
    }

    request.user = {
      id: user.id,
      permission: user.permission,
    };

    return true;
  }
}
