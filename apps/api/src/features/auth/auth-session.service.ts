import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";

import type {
  AuthSessionRecord,
  AuthSessionSummary,
  ConsentDecisionRequest,
  LogoutRequest,
  PendingSsoUser,
  PersistedAccessTokenClaims,
  RefreshSessionRequest,
  RefreshTokenClaims,
  TemporaryAccessTokenClaims,
} from "./auth.types";
import { AuthSessionRepository } from "./auth-session.repository";
import { PendingLoginRepository } from "./pending-login.repository";
import { UsersService } from "../users/users.service";
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_TEMPORARY_REFRESH_TTL_SECONDS,
} from "./auth.tokens";

/**
 * access/refresh token 발급과 rotation, consent 기반 세션 처리를 담당합니다.
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly usersService: UsersService,
  ) {}

  private getJwtSecret(): string {
    const secret = this.configService.get<string>("AUTH_JWT_SECRET");

    if (secret && secret.trim().length > 0) {
      return secret;
    }

    throw new InternalServerErrorException("AUTH_JWT_SECRET_is_required");
  }

  private issueAccessToken(record: AuthSessionRecord): string {
    const claims: PersistedAccessTokenClaims | TemporaryAccessTokenClaims =
      record.mode === "persisted"
        ? {
            mode: "persisted",
            sub: record.userId ?? "",
            userId: record.userId ?? "",
          }
        : {
            mode: "temporary",
            pendingLoginId: record.pendingLoginId ?? "",
            sub: record.pendingLoginId ?? "",
          };

    return jwt.sign(claims, this.getJwtSecret(), {
      expiresIn: AUTH_ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  private issueRefreshToken(record: AuthSessionRecord, refreshJti: string): string {
    const subject = record.mode === "persisted" ? record.userId : record.pendingLoginId;
    const claims: RefreshTokenClaims = {
      jti: refreshJti,
      mode: record.mode,
      sid: record.sessionId,
      sub: subject ?? "",
    };

    return jwt.sign(claims, this.getJwtSecret(), {
      expiresIn: Math.max(Math.floor((record.expiresAt - Date.now()) / 1000), 1),
    });
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenClaims {
    let decoded: string | JwtPayload;

    try {
      decoded = jwt.verify(refreshToken, this.getJwtSecret());
    } catch {
      throw new UnauthorizedException("invalid_refresh_token");
    }

    if (typeof decoded === "string") {
      throw new UnauthorizedException("invalid_refresh_token");
    }

    const sid = typeof decoded.sid === "string" ? decoded.sid : undefined;
    const jti = typeof decoded.jti === "string" ? decoded.jti : undefined;
    const sub = typeof decoded.sub === "string" ? decoded.sub : undefined;
    const mode =
      decoded.mode === "persisted" || decoded.mode === "temporary"
        ? decoded.mode
        : undefined;

    if (!sid || !jti || !sub || !mode) {
      throw new UnauthorizedException("invalid_refresh_token");
    }

    return {
      jti,
      mode,
      sid,
      sub,
    };
  }

  private assertActiveSession(record: AuthSessionRecord | null): asserts record is AuthSessionRecord {
    if (!record) {
      throw new UnauthorizedException("session_not_found");
    }

    if (record.revoked || record.expiresAt <= Date.now()) {
      throw new UnauthorizedException("session_expired_or_revoked");
    }
  }

  /**
   * 영구 사용자용 access/refresh token 쌍을 발급합니다.
   *
   * @param userId PostgreSQL에 저장된 사용자 ID
   */
  async issuePersistedSession(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    session: AuthSessionRecord;
  }> {
    const sessionId = randomUUID();
    const refreshJti = randomUUID();

    const session: AuthSessionRecord = {
      expiresAt: Date.now() + AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000,
      mode: "persisted",
      refreshJti,
      revoked: false,
      sessionId,
      userId,
    };

    await this.authSessionRepository.save(session);

    return {
      accessToken: this.issueAccessToken(session),
      refreshToken: this.issueRefreshToken(session, refreshJti),
      session,
    };
  }

  /**
   * 비동의 임시 로그인용 access/refresh(또는 session key) 세트를 발급합니다.
   *
   * @param pendingLoginId Redis에 저장된 pending login 식별자
   * @param pendingUser Redis에 저장된 임시 사용자 정보
   */
  async issueTemporarySession(
    pendingLoginId: string,
    pendingUser: PendingSsoUser,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    session: AuthSessionRecord;
  }> {
    const sessionId = randomUUID();
    const refreshJti = randomUUID();

    const session: AuthSessionRecord = {
      expiresAt: Math.min(
        pendingUser.expiresAt,
        Date.now() + AUTH_TEMPORARY_REFRESH_TTL_SECONDS * 1000,
      ),
      mode: "temporary",
      pendingLoginId,
      refreshJti,
      revoked: false,
      sessionId,
    };

    await this.authSessionRepository.save(session);

    return {
      accessToken: this.issueAccessToken(session),
      refreshToken: this.issueRefreshToken(session, refreshJti),
      session,
    };
  }

  /**
   * refresh token을 검증하고 rotation을 수행합니다.
   *
   * @param refreshToken refresh token 원문 또는 검증 가능한 식별자
   */
  async rotateRefreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    sessionId: string;
    storageMode: "temporary" | "persisted";
  }> {
    const claims = this.verifyRefreshToken(refreshToken);
    const session = await this.authSessionRepository.findBySessionId(claims.sid);

    this.assertActiveSession(session);

    if (!session.refreshJti || session.refreshJti !== claims.jti) {
      await this.authSessionRepository.revoke(claims.sid);
      throw new UnauthorizedException("refresh_token_reused_or_invalid");
    }

    const rotatedJti = randomUUID();
    const rotatedSession: AuthSessionRecord = {
      ...session,
      refreshJti: rotatedJti,
    };

    await this.authSessionRepository.save(rotatedSession);

    return {
      accessToken: this.issueAccessToken(rotatedSession),
      refreshToken: this.issueRefreshToken(rotatedSession, rotatedJti),
      sessionId: rotatedSession.sessionId,
      storageMode: rotatedSession.mode,
    };
  }

  /**
   * 로그아웃 시 세션을 revoke합니다.
   *
   * @param sessionId 세션 식별자
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.authSessionRepository.revoke(sessionId);
  }

  /**
    * 개인정보 저장 동의/비동의 결정을 처리합니다.
   *
   * @param input 동의 결정 DTO
   */
  async handleConsentDecision(input: ConsentDecisionRequest): Promise<{
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    storageMode: "temporary" | "persisted";
    userId?: string;
  }> {
    const pendingUser = await this.pendingLoginRepository.find(
      input.pendingLoginToken,
    );

    if (!pendingUser) {
      throw new UnauthorizedException("pending_login_not_found_or_expired");
    }

    if (input.consent) {
      const consentedAt = new Date().toISOString();
      const persistedUser = await this.usersService.upsertConsentedSsoUser({
        consentedAt,
        ssoUserId: pendingUser.ssoUserId,
        userEmail: pendingUser.userEmail,
        userMobile: pendingUser.userMobile,
      });

      const issued = await this.issuePersistedSession(persistedUser.id);
      await this.pendingLoginRepository.delete(input.pendingLoginToken);

      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        sessionId: issued.session.sessionId,
        storageMode: "persisted",
        userId: persistedUser.id,
      };
    }

    const issued = await this.issueTemporarySession(input.pendingLoginToken, pendingUser);
    await this.pendingLoginRepository.delete(input.pendingLoginToken);

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      sessionId: issued.session.sessionId,
      storageMode: "temporary",
    };
  }

  /**
    * 현재 로그인 세션 상태를 조회합니다.
   */
  async getSession(sessionId?: string): Promise<AuthSessionSummary> {
    if (!sessionId) {
      return {
        authenticated: false,
        canUsePersistentFeatures: false,
        requiresConsent: false,
        storageMode: null,
      };
    }

    const session = await this.authSessionRepository.findBySessionId(sessionId);

    if (!session || session.revoked || session.expiresAt <= Date.now()) {
      return {
        authenticated: false,
        canUsePersistentFeatures: false,
        requiresConsent: false,
        storageMode: null,
      };
    }

    return {
      authenticated: true,
      canUsePersistentFeatures: session.mode === "persisted",
      requiresConsent: session.mode === "temporary",
      storageMode: session.mode,
      userId: session.userId,
    };
  }

  /**
    * refresh 요청을 처리합니다.
   *
   * @param input refresh 요청 DTO
   */
  async refreshSession(input: RefreshSessionRequest): Promise<{
    accessToken?: string;
    refreshToken?: string;
    sessionId: string;
    storageMode: "temporary" | "persisted";
  }> {
    if (!input.refreshToken) {
      throw new BadRequestException("refreshToken_is_required");
    }

    return this.rotateRefreshToken(input.refreshToken);
  }

  /**
    * 로그아웃을 처리합니다.
   */
  async logout(input?: LogoutRequest): Promise<{ ok: boolean }> {
    if (input?.sessionId) {
      await this.revokeSession(input.sessionId);
    }

    return { ok: true };
  }
}
