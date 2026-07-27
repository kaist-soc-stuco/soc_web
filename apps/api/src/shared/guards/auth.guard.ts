import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AUTH_ACCESS_COOKIE_NAME } from "../../features/auth/auth.tokens";

import { AuthSessionService } from "../../features/auth/auth-session.service";
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
    private readonly authSessionService: AuthSessionService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const accessToken = request.cookies?.[AUTH_ACCESS_COOKIE_NAME];

    if (!accessToken) {
      throw new UnauthorizedException("access_cookie_missing");
    }

    const claims = await this.authSessionService.validateAccessToken(accessToken);
    if (claims.mode !== "persisted") {
      throw new UnauthorizedException("session_invalid");
    }

    const user = await this.usersService.findById(claims.sub);

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
