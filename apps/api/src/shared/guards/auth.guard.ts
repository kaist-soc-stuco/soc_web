import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { Request } from "express";
import { isExpired } from "@soc/shared";

import { AuthSessionRepository } from "../../features/auth/auth-session.repository";
import { AUTH_SESSION_COOKIE_NAME } from "../../features/auth/auth.tokens";
import { UsersService } from "../../features/users/users.service";

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
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
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

    request.user = {
      id: user.id,
      permission: user.permission,
    };

    return true;
  }
}
