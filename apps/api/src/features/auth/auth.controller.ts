import { Body, Controller, ForbiddenException, Get, Inject, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { and, eq } from "drizzle-orm";

import { Cookies } from "../../shared/decorators/cookies.decorator";
import { ConsentDecisionRequestDto, SsoCallbackBodyDto } from "./auth.types";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { permissions, roleGroupPermissions, roleGroups, userRoleGroups } from "../../infrastructure/postgres/postgres.schema";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_SESSION_COOKIE_NAME,
} from "./auth.tokens";
import { nowDate } from "@soc/shared";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly usersService: UsersService,
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
  ) {}

  /** 환경에 맞는 인증 쿠키 공통 옵션을 생성합니다. */
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

  /** 발급된 세션 토큰들을 HttpOnly 쿠키로 내려줍니다. */
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

  /** 기존 인증 쿠키를 모두 제거합니다. */
  private clearAuthCookies(response: Response): void {
    const options = this.getCookieOptions(0);
    response.clearCookie(AUTH_ACCESS_COOKIE_NAME, options);
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, options);
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, options);
  }

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

  /**
   * 개발 환경에서 SSO 없이 바로 persisted 세션을 발급합니다.
   */
  @Post("login/mock")
  async handleMockLogin(@Res({ passthrough: true }) response: Response) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("mock_login_disabled_in_production");
    }

    const now = nowDate();
    const mockUser = await this.usersService.upsertUserFromConsent({
      academicStatus: "재학",
      consentedAt: now,
      departmentEn: "School of Computing",
      departmentKo: "전산학부",
      kaistUid: "DEV0001",
      email: "dev-admin@kaist.ac.kr",
      identityCode: "S",
      nameEn: "Development Admin",
      nameKo: "개발 관리자",
      stdNo: "20260001",
    });

    const [adminPermission] = await this.db
      .select({ permissionId: permissions.permissionId })
      .from(permissions)
      .where(eq(permissions.code, "ADMIN"))
      .limit(1);

    const [surveyManagePermission] = await this.db
      .select({ permissionId: permissions.permissionId })
      .from(permissions)
      .where(
        eq(permissions.code, "MANAGE_SURVEY"),
      )
      .limit(1);

    const [financePermission] = await this.db
      .select({ permissionId: permissions.permissionId })
      .from(permissions)
      .where(eq(permissions.code, "MANAGE_FINANCE"))
      .limit(1);

    if (!adminPermission || !surveyManagePermission || !financePermission) {
      throw new ForbiddenException("admin_permission_missing");
    }

    const [roleGroup] = await this.db
      .insert(roleGroups)
      .values({
        code: "DEV_MOCK_ADMIN",
        description: "개발 환경용 권한 테스트 그룹",
        isSystem: true,
        nameKo: "개발 관리자",
        nameEn: "Development Admin",
      })
      .onConflictDoNothing()
      .returning({ roleGroupId: roleGroups.roleGroupId });

    const existingRoleGroup =
      roleGroup ??
      (await this.db.query.roleGroups.findFirst({
        where: eq(roleGroups.code, "DEV_MOCK_ADMIN"),
      }));

    if (!existingRoleGroup) {
      throw new ForbiddenException("mock_role_group_missing");
    }

    await this.db
      .delete(roleGroupPermissions)
      .where(eq(roleGroupPermissions.roleGroupId, existingRoleGroup.roleGroupId));

    await this.db
      .insert(roleGroupPermissions)
      .values([
        {
          permissionId: adminPermission.permissionId,
          roleGroupId: existingRoleGroup.roleGroupId,
        },
        {
          permissionId: surveyManagePermission.permissionId,
          roleGroupId: existingRoleGroup.roleGroupId,
        },
        {
          permissionId: financePermission.permissionId,
          roleGroupId: existingRoleGroup.roleGroupId,
        },
      ])
      .onConflictDoNothing();

    await this.db
      .delete(userRoleGroups)
      .where(
        and(
          eq(userRoleGroups.userId, mockUser.userId),
          eq(userRoleGroups.roleGroupId, existingRoleGroup.roleGroupId),
        ),
      );

    await this.db.insert(userRoleGroups).values({
      grantedAt: now,
      isActive: true,
      roleGroupId: existingRoleGroup.roleGroupId,
      userId: mockUser.userId,
      validFrom: now,
      validTo: null,
    });

    const issued = await this.authSessionService.issuePersistedSession(mockUser.userId);

    this.setAuthCookies(response, {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      sessionId: issued.session.sessionId,
    });

    return {
      storageMode: "persisted" as const,
      userId: mockUser.userId,
    };
  }

  @Get("login/result")
  async consumeLoginResult(
    @Query("resultToken") resultToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Redirect 이후 1회성 resultToken을 소비해 쿠키 세팅에 필요한 값을 회수합니다.
    const result = await this.authService.consumeLoginResult(resultToken);
    this.setAuthCookies(response, result);

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
   * 현재 로그인 세션 상태를 조회합니다.
   */
  @Get("session")
  async getSession(
    @Cookies(AUTH_SESSION_COOKIE_NAME) cookieSessionId: string | undefined,
  ) {
    return this.authSessionService.getSession(cookieSessionId);
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.refreshSession({
      refreshToken: cookieRefreshToken,
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
   * 현재 세션을 로그아웃 처리합니다.
   */
  @Post("logout")
  async logout(
    @Cookies(AUTH_SESSION_COOKIE_NAME) cookieSessionId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authSessionService.logout({
      sessionId: cookieSessionId,
    });

    this.clearAuthCookies(response);
    return result;
  }
}
