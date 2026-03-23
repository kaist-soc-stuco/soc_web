import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import { Response } from "express";

import { ConsentDecisionRequest, RefreshSessionRequest } from "./auth.types";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";

interface SsoCallbackBody {
  code?: string;
  error?: string;
  errorCode?: string;
  state?: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  /**
   * @description SSO authorize 요청에 필요한 초기 payload를 발급합니다.
   * @returns SSO authorize form submit에 필요한 최소 데이터
   *
   * TODO:
   * - access token / refresh token 구조가 들어와도 이 endpoint는 "로그인 시작"만 담당하게 유지하세요.
   * - 필요하다면 pending login metadata에 redirect 대상과 tracing id를 추가하세요.
   */
  @Get("login/start")
  async startLogin() {
    return this.authService.createLoginStartPayload();
  }

  /**
   * @description SSO provider callback을 받아 사용자 정보를 교환합니다.
   * @returns `/login?...` redirect
   *
   * TODO:
   * - 여기서 바로 redirect만 하지 말고, persisted user 여부에 따라
   *   1) 정식 세션 발급
   *   2) consent-required 상태 생성
   *   로 분기하도록 리팩터링하세요.
   */
  @Post("login")
  async handleLoginCallback(
    @Body() body: SsoCallbackBody,
    @Res() response: Response,
  ): Promise<void> {
    const redirectUrl = await this.authService.handleLoginCallback(body);
    response.redirect(302, redirectUrl);
  }

  /**
   * @description 개인정보 저장 동의/비동의 결정을 처리합니다.
   * @body pendingLoginToken, consent
   *
   * TODO:
   * - consent=true 이면 Redis의 임시 userInfo를 PostgreSQL users 테이블에 저장하세요.
   * - consent=false 이면 sessionStorage 전용 temporary 세션 정책에 맞는 토큰만 발급하세요.
   * - 반환은 최종적으로 access token, refresh token(or temporary session key), storageMode를 포함해야 합니다.
   */
  @Post("login/consent")
  async handleConsentDecision(@Body() body: ConsentDecisionRequest) {
    return this.authSessionService.handleConsentDecision(body);
  }

  /**
   * @description 현재 로그인 세션 상태를 조회합니다.
   *
   * TODO:
   * - `authenticated`, `storageMode`, `requiresConsent`, `canUsePersistentFeatures`를 반환하세요.
   * - 추후 프런트의 `hasPersistedProfile()`가 이 endpoint를 기준으로 동작하게 연결하세요.
   */
  @Get("session")
  async getSession() {
    return this.authSessionService.getSession();
  }

  /**
   * @description access token 만료 시 refresh token 기반으로 세션을 갱신합니다.
   *
   * TODO:
   * - persisted 세션은 refresh token rotation을 적용하세요.
   * - temporary 세션은 sessionStorage 기반 refresh 정책 또는 짧은 TTL session key로 제한하세요.
   */
  @Post("refresh")
  async refreshSession(@Body() body: RefreshSessionRequest) {
    return this.authSessionService.refreshSession(body);
  }

  /**
   * @description 현재 세션을 로그아웃 처리합니다.
   *
   * TODO:
   * - Redis revoke 처리
   * - refresh token 무효화
   * - 필요시 cookie clear 정책 반영
   */
  @Post("logout")
  async logout() {
    return this.authSessionService.logout();
  }
}
