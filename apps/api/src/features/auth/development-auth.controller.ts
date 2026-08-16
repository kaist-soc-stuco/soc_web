import { BadRequestException, Body, Controller, ForbiddenException, Inject, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";

import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./auth-session.service";
import { DevelopmentLoginRequestDto } from "./development-auth.types";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
} from "./auth.tokens";

@Controller("auth")
export class DevelopmentAuthController {
  constructor(
    @Inject(AuthSessionService) private readonly authSessionService: AuthSessionService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  private cookieOptions(path: string, maxAgeSeconds: number) {
    return {
      httpOnly: true,
      maxAge: maxAgeSeconds * 1000,
      path,
      sameSite: "lax" as const,
      secure: this.configService.get<string>("NODE_ENV") === "production",
    };
  }

  @Post("development/login")
  async login(
    @Body() body: DevelopmentLoginRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    if (this.configService.get<string>("NODE_ENV") !== "development") {
      throw new ForbiddenException("development_login_disabled");
    }

    const account = {
      admin: { id: "development-admin", number: "D0000001", nameKr: "개발 관리자", nameEn: "Development Admin", administrator: true },
      "user-1": { id: "development-user-1", number: "D0000002", nameKr: "개발 사용자 1", nameEn: "Development User 1", administrator: false },
      "user-2": { id: "development-user-2", number: "D0000003", nameKr: "개발 사용자 2", nameEn: "Development User 2", administrator: false },
    }[body.account];
    if (!account) throw new BadRequestException("development_account_invalid");

    const user = await this.usersService.convergeDevelopmentFixture({
      consentedAt: new Date().toISOString(),
      kaistUid: account.id,
      nameEn: account.nameEn,
      nameKr: account.nameKr,
      ssoSubject: account.id,
      studentOrEmployeeKind: "EMPLOYEE",
      studentOrEmployeeNumber: account.number,
      userEmail: `${account.id}@kaist.ac.kr`,
    });
    if (account.administrator) await this.usersService.grantAllDevelopmentPermissions(user.id);
    const session = await this.authSessionService.issuePersistedSession(user.id);
    response.cookie(AUTH_ACCESS_COOKIE_NAME, session.accessToken, this.cookieOptions("/api", AUTH_ACCESS_TOKEN_TTL_SECONDS));
    response.cookie(AUTH_REFRESH_COOKIE_NAME, session.refreshToken, this.cookieOptions("/api/auth", AUTH_REFRESH_TOKEN_TTL_SECONDS));
    response.status(204).send();
  }
}
