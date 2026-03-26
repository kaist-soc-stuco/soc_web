import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { parse as parseCookieHeader } from "cookie";
import { Response } from "express";

import {
  ConsentDecisionRequestDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  SsoCallbackBodyDto,
} from "./auth.types";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_SESSION_COOKIE_NAME,
} from "./auth.tokens";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private readCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    const parsed = parseCookieHeader(cookieHeader);
    return parsed[name];
  }

  private getCookieOptions(maxAgeMs: number) {
    const isProd = process.env.NODE_ENV === "production";

    return {
      httpOnly: true,
      maxAge: maxAgeMs,
      path: "/",
      sameSite: "lax" as const,
      secure: isProd,
    };
  }

  private setAuthCookies(
    response: Response,
    payload: {
      accessToken?: string;
      refreshToken?: string;
      sessionId?: string;
    },
  ): void {
    if (payload.accessToken) {
      response.cookie(
        AUTH_ACCESS_COOKIE_NAME,
        payload.accessToken,
        this.getCookieOptions(AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
      );
    }

    if (payload.refreshToken) {
      response.cookie(
        AUTH_REFRESH_COOKIE_NAME,
        payload.refreshToken,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
      );
    }

    if (payload.sessionId) {
      response.cookie(
        AUTH_SESSION_COOKIE_NAME,
        payload.sessionId,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
      );
    }
  }

  private clearAuthCookies(response: Response): void {
    const options = this.getCookieOptions(0);
    response.clearCookie(AUTH_ACCESS_COOKIE_NAME, options);
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, options);
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, options);
  }

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
  async consumeLoginResult(
    @Query("resultToken") resultToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.consumeLoginResult(resultToken);
    this.setAuthCookies(response, result);

    return {
      storageMode: result.storageMode,
      userId: result.userId,
    };
  }

  /**
   * @description 개인정보 저장 동의/비동의 결정을 처리합니다.
   * @body pendingLoginToken, consent
   */
  @Post("login/consent")
  async handleConsentDecision(
    @Body() body: ConsentDecisionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.handleConsentDecision(body);

    if (result.storageMode === "persisted") {
      this.setAuthCookies(response, result);
    } else {
      this.clearAuthCookies(response);
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
   * @description 현재 로그인 세션 상태를 조회합니다.
   */
  @Get("session")
  async getSession(
    @Query("sessionId") sessionId: string | undefined,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const cookieSessionId = this.readCookie(cookieHeader, AUTH_SESSION_COOKIE_NAME);
    return this.authSessionService.getSession(cookieSessionId ?? sessionId);
  }

  /**
   * @description access token 만료 시 refresh token 기반으로 세션을 갱신합니다.
   */
  @Post("refresh")
  async refreshSession(
    @Body() body: RefreshSessionRequestDto,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieRefreshToken = this.readCookie(cookieHeader, AUTH_REFRESH_COOKIE_NAME);
    const result = await this.authSessionService.refreshSession({
      ...body,
      refreshToken: body.refreshToken ?? cookieRefreshToken,
    });

    if (result.storageMode === "persisted") {
      this.setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
      });

      return {
        storageMode: result.storageMode,
      };
    }

    this.clearAuthCookies(response);

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
   * @description 현재 세션을 로그아웃 처리합니다.
   */
  @Post("logout")
  async logout(
    @Body() body: LogoutRequestDto,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieSessionId = this.readCookie(cookieHeader, AUTH_SESSION_COOKIE_NAME);
    const result = await this.authSessionService.logout({
      ...body,
      sessionId: body.sessionId ?? cookieSessionId,
    });

    this.clearAuthCookies(response);
    return result;
  }
}
