import { Injectable } from "@nestjs/common";

import type {
  AuthSessionRecord,
  AuthSessionSummary,
  ConsentDecisionRequest,
  PendingSsoUser,
  PersistedAccessTokenClaims,
  RefreshSessionRequest,
  RefreshTokenClaims,
  TemporaryAccessTokenClaims,
} from "./auth.types";
import { AuthSessionRepository } from "./auth-session.repository";

/**
 * access token / refresh token 발급 및 회전 로직을 담당할 서비스 골격입니다.
 *
 * TODO:
 * 1. persisted/temporary 모드의 토큰 발급 정책을 먼저 분리하세요.
 * 2. refresh rotation은 repository와 함께 한 세트로 구현하세요.
 * 3. 여기서는 토큰 발급만, 쿠키 설정은 controller/helper로 나누는 편이 유지보수에 유리합니다.
 */
@Injectable()
export class AuthSessionService {
  constructor(private readonly authSessionRepository: AuthSessionRepository) {}

  /**
   * 영구 사용자용 access/refresh token 쌍을 발급합니다.
   *
   * @param _userId PostgreSQL에 저장된 사용자 ID
   */
  async issuePersistedSession(_userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    session: AuthSessionRecord;
  }> {
    void this.authSessionRepository;
    throw new Error("TODO: persisted access/refresh token 발급 구현");
  }

  /**
   * 비동의 임시 로그인용 access/refresh(또는 session key) 세트를 발급합니다.
   *
   * @param _pendingLoginId Redis에 저장된 pending login 식별자
   * @param _pendingUser Redis에 저장된 임시 사용자 정보
   */
  async issueTemporarySession(
    _pendingLoginId: string,
    _pendingUser: PendingSsoUser,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    session: AuthSessionRecord;
  }> {
    void this.authSessionRepository;
    throw new Error("TODO: temporary access token / refresh token 발급 구현");
  }

  /**
   * refresh token을 검증하고 rotation을 수행합니다.
   *
   * @param _refreshToken refresh token 원문 또는 검증 가능한 식별자
   */
  async rotateRefreshToken(_refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    void this.authSessionRepository;
    throw new Error("TODO: refresh token rotation 구현");
  }

  /**
   * 로그아웃 시 세션을 revoke합니다.
   *
   * @param _sessionId 세션 식별자
   */
  async revokeSession(_sessionId: string): Promise<void> {
    void this.authSessionRepository;
    throw new Error("TODO: session revoke 구현");
  }

  /**
   * 개인정보 저장 동의/비동의 결정을 처리하는 스켈레톤입니다.
   *
   * @param _input 동의 결정 DTO
   */
  async handleConsentDecision(_input: ConsentDecisionRequest): Promise<{
    accessToken?: string;
    refreshToken?: string;
    storageMode: "temporary" | "persisted";
  }> {
    void this.authSessionRepository;
    throw new Error("TODO: 개인정보 저장 동의 처리 구현");
  }

  /**
   * 현재 로그인 세션 상태 조회 스켈레톤입니다.
   */
  async getSession(): Promise<AuthSessionSummary> {
    void this.authSessionRepository;
    throw new Error("TODO: 현재 로그인 세션 상태 조회 구현");
  }

  /**
   * refresh 요청 처리 스켈레톤입니다.
   *
   * @param _input refresh 요청 DTO
   */
  async refreshSession(_input: RefreshSessionRequest): Promise<{
    accessToken?: string;
    refreshToken?: string;
  }> {
    void this.authSessionRepository;
    throw new Error("TODO: refresh session 처리 구현");
  }

  /**
   * 로그아웃 처리 스켈레톤입니다.
   */
  async logout(): Promise<{ ok: boolean }> {
    void this.authSessionRepository;
    throw new Error("TODO: 로그아웃 처리 구현");
  }

  /**
   * 토큰 클레임 타입 예시입니다. 구현 시 실제 JWT payload 설계 기준으로 사용하세요.
   */
  createClaimExamples(): {
    persisted: PersistedAccessTokenClaims;
    refresh: RefreshTokenClaims;
    temporary: TemporaryAccessTokenClaims;
  } {
    return {
      persisted: {
        mode: "persisted",
        sub: "user-id",
        userId: "user-id",
      },
      refresh: {
        jti: "refresh-jti",
        mode: "persisted",
        sid: "session-id",
        sub: "user-id",
      },
      temporary: {
        mode: "temporary",
        pendingLoginId: "pending-login-id",
        sub: "pending-user",
      },
    };
  }
}
