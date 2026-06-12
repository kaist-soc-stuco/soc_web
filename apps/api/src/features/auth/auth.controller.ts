import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";

import { Cookies } from "../../shared/decorators/cookies.decorator";
import {
  ConsentDecisionRequestDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  SsoCallbackBodyDto,
} from "./auth.types";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
} from "./auth.tokens";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authCookieService: AuthCookieService,
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) { }

  /**
   * SSO authorize 요청에 필요한 초기 payload를 발급합니다.
   */
  @Get("login/start")
  async startLogin() {
    return this.authService.createLoginStartPayload();
  }

  /**
   * SSO provider callback을 받아 사용자 정보를 교환합니다.
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
  async consumeLoginResult(
    @Query("resultToken") resultToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Redirect 이후 1회성 resultToken을 소비해 쿠키 세팅에 필요한 값을 회수합니다.
    const result = await this.authService.consumeLoginResult(resultToken);
    this.authCookieService.setAuthCookies(response, result);

    return {
      storageMode: result.storageMode,
      userId: result.userId,
    };
  }

  /**
   * 개인정보 저장 동의/비동의 결정을 처리합니다.
   * @body pendingLoginToken, consent
   */
  @Post("login/consent")
  async handleConsentDecision(
    @Body() body: ConsentDecisionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.handleConsentDecision(body);

    if (result.storageMode === "persisted") {
      this.authCookieService.setAuthCookies(response, result);
    } else {
      this.authCookieService.clearAuthCookies(response);
    }

    return {
      storageMode: result.storageMode,
      temporarySession:
        result.storageMode === "temporary"
          ? {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            sessionId: result.sessionId,
          }
          : undefined,
      userId: result.userId,
    };
  }

  /**
   * 현재 로그인 세션 상태를 조회합니다.
   */
  @Get("session")
  async getSession(
    @Cookies(AUTH_SESSION_COOKIE_NAME) cookieSessionId: string | undefined,
    @Query("sessionId") querySessionId: string | undefined,
  ) {
    return this.authSessionService.getSession(cookieSessionId ?? querySessionId);
  }

  /**
   * access token 유효성을 확인하는 테스트용 endpoint입니다.
   */
  @Get("access-check")
  async checkAccessToken(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) cookieAccessToken: string | undefined,
  ) {
    const claims =
      this.authSessionService.validateAccessToken(cookieAccessToken);

    return {
      mode: claims.mode,
      ok: true,
    };
  }

  /**
   * access token 기준 현재 사용자 정보를 조회합니다.
   */
  @Get("me")
  async getCurrentUser(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) cookieAccessToken: string | undefined,
  ) {
    return this.authSessionService.getCurrentUser(cookieAccessToken);
  }

  /**
   * access token 만료 시 refresh token 기반으로 세션을 갱신합니다.
   */
  @Post("refresh")
  async refreshSession(
    @Cookies(AUTH_REFRESH_COOKIE_NAME) cookieRefreshToken: string | undefined,
    @Body() body: RefreshSessionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.refreshSession({
      refreshToken: cookieRefreshToken ?? body?.refreshToken,
      sessionId: body?.sessionId,
    });

    if (result.storageMode === "persisted") {
      this.authCookieService.setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      });

      return {
        storageMode: result.storageMode,
      };
    }

    this.authCookieService.clearAuthCookies(response);

    return {
      storageMode: result.storageMode,
      temporarySession: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      },
    };
  }

  /**
   * 현재 세션을 로그아웃 처리합니다.
   */
  @Post("logout")
  async logout(
    @Cookies(AUTH_SESSION_COOKIE_NAME) cookieSessionId: string | undefined,
    @Body() body: LogoutRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.logout({
      sessionId: cookieSessionId ?? body?.sessionId,
    });

    this.authCookieService.clearAuthCookies(response);
    return result;
  }
}
