import { Controller, Post, Res } from "@nestjs/common";
import { Response } from "express";

import { AuthCookieService } from "./auth-cookie.service";
import { AuthDevLoginService } from "./auth-dev-login.service";

@Controller("auth")
export class AuthDevController {
  constructor(
    private readonly authCookieService: AuthCookieService,
    private readonly authDevLoginService: AuthDevLoginService,
  ) {}

  /**
   * 개발 환경에서 SSO 없이 바로 persisted 세션을 발급합니다.
   */
  @Post("login/mock")
  async handleMockLogin(@Res({ passthrough: true }) response: Response) {
    const issued = await this.authDevLoginService.issueMockAdminSession();

    this.authCookieService.setAuthCookies(response, {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      sessionId: issued.sessionId,
    });

    return {
      storageMode: issued.storageMode,
      userId: issued.userId,
    };
  }
}
