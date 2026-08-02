import {
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Post,
  Res,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";

import { Cookies } from "../../shared/decorators/cookies.decorator";
import { ConsentDecisionRequestDto, DevelopmentLoginRequestDto, SsoCallbackBodyDto } from "./auth.types";
import { AuthSessionService } from "./auth-session.service";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_FLOW_COOKIE_NAME,
  AUTH_FLOW_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_TEMPORARY_COOKIE_NAME,
  AUTH_TEMPORARY_TOKEN_TTL_SECONDS,
  AUTH_SSO_STATE_COOKIE_NAME,
  AUTH_SSO_STATE_TTL_SECONDS,
} from "./auth.tokens";
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthSessionService) private readonly authSessionService: AuthSessionService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  private getCookieOptions(path: string, maxAgeMs: number) {
    return {
      httpOnly: true,
      maxAge: maxAgeMs,
      path,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
  }

  private setPersistedCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(
      AUTH_ACCESS_COOKIE_NAME,
      accessToken,
      this.getCookieOptions("/api", AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
    );
    response.cookie(
      AUTH_REFRESH_COOKIE_NAME,
      refreshToken,
      this.getCookieOptions("/api/auth", AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
    );
  }

  private setOpaqueCookie(
    response: Response,
    name: string,
    value: string,
    maxAgeSeconds: number,
  ): void {
    response.cookie(
      name,
      value,
      this.getCookieOptions("/api/auth", maxAgeSeconds * 1000),
    );
  }

  private clearCookie(response: Response, name: string, path: string): void {
    response.cookie(name, "", {
      ...this.getCookieOptions(path, 0),
      expires: new Date(0),
    });
  }

  private clearAuthCookies(response: Response): void {
    this.clearCookie(response, AUTH_ACCESS_COOKIE_NAME, "/api");
    this.clearCookie(response, AUTH_REFRESH_COOKIE_NAME, "/api/auth");
    this.clearCookie(response, AUTH_FLOW_COOKIE_NAME, "/api/auth");
    this.clearCookie(response, AUTH_TEMPORARY_COOKIE_NAME, "/api/auth");
  }

  @Get("login/start")
  async startLogin(@Res() response: Response) {
    const payload = await this.authService.createLoginStartPayload();
    response.cookie(AUTH_SSO_STATE_COOKIE_NAME, payload.transactionSecret, {
      httpOnly: true, maxAge: AUTH_SSO_STATE_TTL_SECONDS * 1000,
      path: "/api/auth/login", sameSite: "none", secure: true,
    });
    const { transactionSecret: _secret, ...publicPayload } = payload;
    return response.json(publicPayload);
  }

  @Post("login")
  async handleLoginCallback(
    @Body() body: SsoCallbackBodyDto,
    @Headers("content-type") contentType: string | undefined,
    @Cookies(AUTH_SSO_STATE_COOKIE_NAME) transactionSecret: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    this.clearCookie(response, AUTH_SSO_STATE_COOKIE_NAME, "/api/auth/login");
    if (!contentType?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      throw new UnsupportedMediaTypeException("login_callback_requires_form_urlencoded_body");
    }

    const result = await this.authService.handleLoginCallback(body, transactionSecret);
    const publicOrigin = this.configService.getOrThrow<string>("PUBLIC_ORIGIN");

    if (result.kind === "persisted") {
      this.setPersistedCookies(response, result.session.accessToken, result.session.refreshToken);
      response.redirect(303, `${publicOrigin}/login?status=success`);
      return;
    }

    this.setOpaqueCookie(
      response,
      AUTH_FLOW_COOKIE_NAME,
      result.flowToken,
      AUTH_FLOW_TOKEN_TTL_SECONDS,
    );
    response.redirect(303, `${publicOrigin}/login/consent`);
  }

  @Post("login/consent")
  async handleConsentDecision(
    @Body() body: ConsentDecisionRequestDto,
    @Cookies(AUTH_FLOW_COOKIE_NAME) flowToken: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.authSessionService.handleConsentDecision({
      consent: body.consent,
      pendingLoginToken: flowToken ?? "",
    });

    this.clearCookie(response, AUTH_FLOW_COOKIE_NAME, "/api/auth");
    if (result.kind === "persisted") {
      this.setPersistedCookies(response, result.session.accessToken, result.session.refreshToken);
    } else {
      this.setOpaqueCookie(
        response,
        AUTH_TEMPORARY_COOKIE_NAME,
        result.temporaryHandle,
        AUTH_TEMPORARY_TOKEN_TTL_SECONDS,
      );
    }

    response.status(204).send();
  }

  @Get("session")
  async getSession(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken: string | undefined,
    @Cookies(AUTH_TEMPORARY_COOKIE_NAME) temporaryToken: string | undefined,
  ) {
    return this.authSessionService.getSession({ accessToken, temporaryToken });
  }
  @Post("development/login")
  async loginWithDevelopmentAccount(
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
    this.setPersistedCookies(response, session.accessToken, session.refreshToken);
    response.status(204).send();
  }

  @Post("refresh")
  async refreshSession(
    @Cookies(AUTH_REFRESH_COOKIE_NAME) refreshToken: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const result = await this.authSessionService.refreshSession({ refreshToken });
      this.setPersistedCookies(response, result.accessToken, result.refreshToken);
      response.status(204).send();
    } catch (error) {
      if (error instanceof ConflictException) {
        response.setHeader("Retry-After", "1");
      }
      throw error;
    }
  }

  @Post("logout")
  async logout(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken: string | undefined,
    @Cookies(AUTH_REFRESH_COOKIE_NAME) refreshToken: string | undefined,
    @Cookies(AUTH_TEMPORARY_COOKIE_NAME) temporaryToken: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    await this.authSessionService.logout({ accessToken, refreshToken, temporaryToken });
    this.clearAuthCookies(response);
    response.status(204).send();
  }
}
