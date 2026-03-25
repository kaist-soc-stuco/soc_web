import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";

import {
  ConsentDecisionRequestDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  SsoCallbackBodyDto,
} from "./auth.types";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  /**
   * @description SSO authorize 요청에 필요한 초기 payload를 발급합니다.
   * @returns SSO authorize form submit에 필요한 최소 데이터
   */
  @Get("login/start")
  async startLogin() {
    return this.authService.createLoginStartPayload();
  }

  /**
   * @description SSO provider callback을 받아 사용자 정보를 교환합니다.
   * @returns `/login?...` redirect
   */
  @Post("login")
  async handleLoginCallback(
    @Body() body: SsoCallbackBodyDto,
    @Res() response: Response,
  ): Promise<void> {
    const redirectUrl = await this.authService.handleLoginCallback(body);
    response.redirect(302, redirectUrl);
  }

  @Get("login/result")
  async consumeLoginResult(@Query("resultToken") resultToken?: string) {
    return this.authService.consumeLoginResult(resultToken);
  }

  /**
   * @description 개인정보 저장 동의/비동의 결정을 처리합니다.
   * @body pendingLoginToken, consent
   */
  @Post("login/consent")
  async handleConsentDecision(@Body() body: ConsentDecisionRequestDto) {
    return this.authSessionService.handleConsentDecision(body);
  }

  /**
   * @description 현재 로그인 세션 상태를 조회합니다.
   */
  @Get("session")
  async getSession(@Query("sessionId") sessionId?: string) {
    return this.authSessionService.getSession(sessionId);
  }

  /**
   * @description access token 만료 시 refresh token 기반으로 세션을 갱신합니다.
   */
  @Post("refresh")
  async refreshSession(@Body() body: RefreshSessionRequestDto) {
    return this.authSessionService.refreshSession(body);
  }

  /**
   * @description 현재 세션을 로그아웃 처리합니다.
   */
  @Post("logout")
  async logout(@Body() body: LogoutRequestDto) {
    return this.authSessionService.logout(body);
  }
}
