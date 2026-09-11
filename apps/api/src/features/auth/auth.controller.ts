import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Query,
  Req,
  Res,
  Optional,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import type { Request } from "express";

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
import { AuditLogService } from "../audit/audit-log.service";
import { OptionalAuthGuard } from "./guards";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_CSRF_COOKIE_NAME,
  AUTH_LOGIN_TRANSACTION_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SSO_TRANSACTION_COOKIE_NAME,
  extractBearerToken,
} from "./auth.tokens";

interface ChannelTalkRequest extends Request {
  user?: {
    id: string;
    permission: number;
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authCookieService: AuthCookieService,
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) { }

  /**
   * SSO authorize 요청에 필요한 초기 payload를 발급합니다.
   */
  @Get("login/start")
  async startLogin(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const payload = await this.authService.createLoginStartPayload();
    // The state is also stored in an HttpOnly cookie so a callback copied from
    // another browser cannot complete this browser's login transaction.
    this.authCookieService.setSsoTransactionCookie(response, payload.state, request);
    return payload;
  }

  @Get("channel-talk")
  @UseGuards(OptionalAuthGuard)
  async getChannelTalkConfig(@Req() request: ChannelTalkRequest) {
    return this.authService.getChannelTalkConfig(request.user?.id);
  }

  @Get("csrf")
  getCsrfToken(
    @Req() request: Request & { csrfToken?: string },
  ) {
    const csrfToken = request.csrfToken ?? request.cookies?.[AUTH_CSRF_COOKIE_NAME];
    if (!csrfToken) {
      throw new InternalServerErrorException("csrf_token_unavailable");
    }
    return { csrfToken };
  }

  /**
   * SSO provider callback을 받아 사용자 정보를 교환합니다.
   */
  @Post("login")
  async handleLoginCallback(
    @Body() body: SsoCallbackBodyDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.authService.handleLoginCallback(
      body,
      request.cookies?.[AUTH_SSO_TRANSACTION_COOKIE_NAME],
    );
    this.authCookieService.clearSsoTransactionCookie(response, request);
    if (result.transactionToken) {
      this.authCookieService.setLoginTransactionCookie(
        response,
        result.transactionToken,
        request,
      );
    }
    const redirectUrl = result.redirectUrl;
    const redirect = new URL(redirectUrl, "http://localhost");
    await this.auditLogService?.record({
      action: "auth.sso.callback",
      actorUserId: null,
      ipAddress: request.ip ?? null,
      payload: {
        reason: redirect.searchParams.get("reason") ?? "unknown",
        status: redirect.searchParams.get("status") ?? "unknown",
      },
      targetType: "auth",
    });
    response.redirect(302, redirectUrl);
  }

  @Post("login/result")
  async consumeLoginResult(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // The one-time token is HttpOnly and never enters the URL or browser
    // storage. Redis GETDEL makes this completion single-use.
    const transactionToken = request.cookies?.[AUTH_LOGIN_TRANSACTION_COOKIE_NAME];
    const result = await this.authService.consumeLoginResult(transactionToken);
    this.authCookieService.setAuthCookies(response, result, request);
    this.authCookieService.clearLoginTransactionCookie(response, request);
    await this.auditLogService?.record({
      action: "auth.login.success",
      actorUserId: result.userId ?? null,
      ipAddress: request.ip ?? null,
      payload: { storageMode: result.storageMode },
      targetId: result.userId ?? null,
      targetType: result.userId ? "user" : "auth",
    });

    return {
      storageMode: result.storageMode,
      userId: result.userId,
    };
  }

  /**
   * 개인정보 저장 동의/비동의 결정을 처리합니다.
   * @body consent
   */
  @Post("login/consent")
  async handleConsentDecision(
    @Body() body: ConsentDecisionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const transactionToken = request.cookies?.[AUTH_LOGIN_TRANSACTION_COOKIE_NAME];
    const pendingLoginToken = await this.authService.getPendingLoginToken(
      transactionToken,
    );
    const result = await this.authSessionService.handleConsentDecision({
      consent: body.consent,
      pendingLoginToken,
    });
    await this.authService.clearLoginTransaction(transactionToken);
    this.authCookieService.clearLoginTransactionCookie(response, request);

    if (result.storageMode === "persisted") {
      this.authCookieService.setAuthCookies(response, result, request);
    } else {
      this.authCookieService.clearAuthCookies(response, request);
    }

    await this.auditLogService?.record({
      action: "auth.login.consent",
      actorUserId: result.userId ?? null,
      ipAddress: request.ip ?? null,
      payload: {
        consent: body.consent,
        storageMode: result.storageMode,
      },
      targetId: result.userId ?? null,
      targetType: result.userId ? "user" : "auth",
    });

    return {
      storageMode: result.storageMode,
      temporarySession:
        result.storageMode === "temporary"
          ? {
              accessToken: result.accessToken,
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
    @Req() request: Request,
  ) {
    return this.authSessionService.getSession(
      cookieSessionId ?? querySessionId,
      extractBearerToken(request.headers.authorization),
    );
  }

  /**
   * access token 기준 현재 사용자 정보를 조회합니다.
   */
  @Get("me")
  async getCurrentUser(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) cookieAccessToken: string | undefined,
    @Req() request: Request,
  ) {
    return this.authSessionService.getCurrentUser(
      cookieAccessToken ?? extractBearerToken(request.headers.authorization),
    );
  }

  /**
   * access token 만료 시 refresh token 기반으로 세션을 갱신합니다.
   */
  @Post("refresh")
  async refreshSession(
    @Cookies(AUTH_REFRESH_COOKIE_NAME) cookieRefreshToken: string | undefined,
    @Body() body: RefreshSessionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.refreshSession({
      refreshToken: cookieRefreshToken ?? body?.refreshToken,
      sessionId: body?.sessionId,
    });

    this.authCookieService.setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    }, request);
    return {
      storageMode: result.storageMode,
    };
  }

  /**
   * 현재 세션을 로그아웃 처리합니다.
   */
  @Post("logout")
  async logout(
    @Cookies(AUTH_SESSION_COOKIE_NAME) cookieSessionId: string | undefined,
    @Body() body: LogoutRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.logout({
      sessionId: cookieSessionId ?? body?.sessionId,
    });

    this.authCookieService.clearAuthCookies(response, request);
    await this.auditLogService?.record({
      action: "auth.logout",
      actorUserId: null,
      ipAddress: request.ip ?? null,
      payload: { sessionIdProvided: Boolean(cookieSessionId ?? body?.sessionId) },
      targetType: "auth",
    });
    return result;
  }
}
