import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { expiresAtMs, isExpired } from "@soc/shared";

import type {
  AuthSessionRecord,
  AuthSessionSummary,
  ConsentDecisionRequest,
  ConsentDecisionResult,
  IssuedSessionResult,
  LogoutRequest,
  PersistedAccessTokenClaims,
  RefreshSessionRequest,
  RefreshSessionResult,
  RefreshTokenClaims,
  TemporaryAccessTokenClaims,
  TokenClaims,
} from "./auth.types";
import { AuthSessionRepository } from "./auth-session.repository";
import { PendingLoginRepository } from "./pending-login.repository";
import { UsersService } from "../users/users.service";
import {
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_TEMPORARY_TOKEN_TTL_SECONDS,
} from "./auth.tokens";

const ACCESS_TTL_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 30;

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly usersService: UsersService,
  ) {}

  private jwtConfig() {
    const activeKid = this.required("AUTH_JWT_ACTIVE_KID");
    const privatePem = this.required("AUTH_JWT_ES256_PRIVATE_KEY");
    const issuer = this.required("AUTH_JWT_ISSUER");
    const audience = this.required("AUTH_JWT_AUDIENCE");
    let publicKeys: Record<string, string>;
    try {
      publicKeys = JSON.parse(this.required("AUTH_JWT_PUBLIC_KEYS_JSON")) as Record<string, string>;
    } catch {
      throw new InternalServerErrorException("AUTH_JWT_PUBLIC_KEYS_JSON_invalid");
    }
    if (
      !publicKeys ||
      Array.isArray(publicKeys) ||
      !Object.values(publicKeys).every(
        (value) => typeof value === "string" && value.trim(),
      ) ||
      !publicKeys[activeKid]
    ) {
      throw new InternalServerErrorException("AUTH_JWT_PUBLIC_KEYS_JSON_invalid");
    }
    return { activeKid, audience, issuer, privatePem, publicKeys };
  }

  private required(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value?.trim()) throw new InternalServerErrorException(`${name}_is_required`);
    return value;
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  private signToken(claims: TokenClaims | RefreshTokenClaims): string {
    const config = this.jwtConfig();
    const header = { alg: "ES256", kid: config.activeKid };
    const signingInput = `${this.encode(header)}.${this.encode(claims)}`;
    const signature = sign("sha256", Buffer.from(signingInput), {
      key: createPrivateKey(config.privatePem),
      dsaEncoding: "ieee-p1363",
    });
    return `${signingInput}.${signature.toString("base64url")}`;
  }

  private verifyToken(token: string, refresh: boolean): TokenClaims | RefreshTokenClaims {
    const invalid = () => {
      throw new UnauthorizedException(
        refresh ? "invalid_refresh_token" : "invalid_access_token",
      );
    };
    const decodeBase64Url = (value: string): Buffer => {
      if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) invalid();
      const decoded = Buffer.from(value, "base64url");
      if (decoded.toString("base64url") !== value) invalid();
      return decoded;
    };
    const parts = token.split(".");
    if (parts.length !== 3) invalid();

    let header: unknown;
    let payload: unknown;
    let signature: Uint8Array = new Uint8Array();
    try {
      const headerBytes = decodeBase64Url(parts[0]);
      const payloadBytes = decodeBase64Url(parts[1]);
      signature = decodeBase64Url(parts[2]);
      if (signature.length !== 64) invalid();
      header = JSON.parse(headerBytes.toString("utf8"));
      payload = JSON.parse(payloadBytes.toString("utf8"));
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      invalid();
    }

    if (
      !header ||
      typeof header !== "object" ||
      Array.isArray(header) ||
      Object.keys(header).length !== 2 ||
      (header as Record<string, unknown>).alg !== "ES256" ||
      typeof (header as Record<string, unknown>).kid !== "string" ||
      !(header as Record<string, string>).kid
    ) invalid();

    const config = this.jwtConfig();
    const publicPem = config.publicKeys[(header as Record<string, string>).kid];
    if (!publicPem) invalid();
    try {
      if (!verify(
        "sha256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        { key: createPublicKey(publicPem), dsaEncoding: "ieee-p1363" },
        signature,
      )) invalid();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      invalid();
    }

    const claimValues =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    if (claimValues.iss !== config.issuer || claimValues.aud !== config.audience) invalid();

    const now = Math.floor(Date.now() / 1000);
    if (
      typeof claimValues.iat !== "number" ||
      !Number.isFinite(claimValues.iat) ||
      typeof claimValues.exp !== "number" ||
      !Number.isFinite(claimValues.exp) ||
      claimValues.iat > now + CLOCK_SKEW_SECONDS ||
      claimValues.exp <= now - CLOCK_SKEW_SECONDS
    ) invalid();

    const required = ["iss", "aud", "sub", "sid", "mode", "iat", "exp"];
    if (refresh) required.push("jti");
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(claimValues).some((key) => !required.includes(key)) ||
      required.some(
        (key) => typeof claimValues[key] !==
          (key === "iat" || key === "exp" ? "number" : "string"),
      ) ||
      (claimValues.mode !== "persisted" && claimValues.mode !== "temporary")
    ) invalid();
    return claimValues as unknown as TokenClaims | RefreshTokenClaims;
  }

  private tokenClaims(record: AuthSessionRecord, ttl: number): TokenClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      aud: this.jwtConfig().audience, exp: now + ttl, iat: now,
      iss: this.jwtConfig().issuer, mode: record.mode,
      sid: record.sessionId, sub: record.mode === "persisted" ? record.userId! : record.pendingLoginId!,
    };
  }

  private issueAccessToken(record: AuthSessionRecord): string {
    return this.signToken(this.tokenClaims(record, ACCESS_TTL_SECONDS));
  }

  private issueRefreshToken(record: AuthSessionRecord, jti: string): string {
    const ttl = Math.max(1, Math.floor((record.expiresAt - Date.now()) / 1000));
    return this.signToken({ ...this.tokenClaims(record, ttl), jti });
  }

  private assertActiveSession(record: AuthSessionRecord | null): asserts record is AuthSessionRecord {
    if (!record) throw new UnauthorizedException("session_not_found");
    if (record.revoked || isExpired(record.expiresAt)) throw new UnauthorizedException("session_expired_or_revoked");
  }

  async issuePersistedSession(userId: string): Promise<IssuedSessionResult> {
    const sessionId = randomUUID();
    const session: AuthSessionRecord = {
      expiresAt: expiresAtMs(AUTH_REFRESH_TOKEN_TTL_SECONDS), familyId: sessionId,
      familyVersion: 0, mode: "persisted", refreshJti: randomUUID(),
      revoked: false, sessionId, userId,
    };
    await this.authSessionRepository.save(session);
    return { accessToken: this.issueAccessToken(session), refreshToken: this.issueRefreshToken(session, session.refreshJti), session };
  }

  async issueTemporarySession(pendingLoginId: string, expiresAt: number): Promise<AuthSessionRecord> {
    const sessionId = randomUUID();
    const session: AuthSessionRecord = {
      expiresAt: Math.min(expiresAt, expiresAtMs(AUTH_TEMPORARY_TOKEN_TTL_SECONDS)),
      familyId: sessionId, familyVersion: 0, mode: "temporary",
      pendingLoginId, refreshJti: randomUUID(), revoked: false, sessionId,
    };
    await this.authSessionRepository.save(session);
    return session;
  }

  async rotateRefreshToken(refreshToken: string): Promise<RefreshSessionResult> {
    const claims = this.verifyToken(refreshToken, true) as RefreshTokenClaims;
    const session = await this.authSessionRepository.findBySessionId(claims.sid);
    this.assertActiveSession(session);
    if (session.mode !== claims.mode || (session.mode === "persisted" ? session.userId : session.pendingLoginId) !== claims.sub) {
      throw new UnauthorizedException("invalid_refresh_token");
    }
    const jti = randomUUID();
    const outcome = await this.authSessionRepository.rotateRefresh(
      session.sessionId,
      claims.jti,
      jti,
      session.expiresAt,
    );
    if (outcome === "already_rotated") throw new ConflictException("refresh_already_rotated");
    if (outcome === "replayed") throw new UnauthorizedException("refresh_replay_detected");
    if (outcome !== "rotated") throw new UnauthorizedException("invalid_refresh_token");
    const rotated = {
      ...session,
      familyVersion: session.familyVersion + 1,
      previousRefreshJti: session.refreshJti,
      refreshJti: jti,
      rotatedAtMs: Date.now(),
    };
    return { accessToken: this.issueAccessToken(rotated), refreshToken: this.issueRefreshToken(rotated, jti), sessionId: session.sessionId, storageMode: session.mode };
  }

  async validateAccessToken(accessToken: string | undefined): Promise<PersistedAccessTokenClaims | TemporaryAccessTokenClaims> {
    if (!accessToken) throw new UnauthorizedException("access_token_missing");
    const claims = this.verifyToken(accessToken, false) as TokenClaims;
    const session = await this.authSessionRepository.findBySessionId(claims.sid);
    this.assertActiveSession(session);
    if (session.mode !== claims.mode || (session.mode === "persisted" ? session.userId : session.pendingLoginId) !== claims.sub) {
      throw new UnauthorizedException("invalid_access_token");
    }
    return claims as PersistedAccessTokenClaims | TemporaryAccessTokenClaims;
  }

  async handleConsentDecision(input: ConsentDecisionRequest): Promise<ConsentDecisionResult> {
    if (!input.pendingLoginToken?.trim()) throw new BadRequestException("pending_login_token_is_required");
    const reservation = await this.pendingLoginRepository.reserve(input.pendingLoginToken);
    if (!reservation) throw new UnauthorizedException("pending_login_not_found_or_expired");
    const { pending, reservationToken } = reservation;
    const assertOwnership = async () => {
      if (!(await this.pendingLoginRepository.renew(input.pendingLoginToken, reservationToken))) {
        throw new ConflictException("pending_login_ownership_lost");
      }
    };
    try {
      if (input.consent) {
        await assertOwnership();
        const { expiresAt: _expiresAt, ...profile } = pending;
        const user = await this.usersService.synchronizeAuthoritativeSsoProfile({
          ...profile,
          consentedAt: new Date().toISOString(),
        });
        await assertOwnership();
        const result = {
          kind: "persisted" as const,
          session: await this.issuePersistedSession(user.id),
          userId: user.id,
        };
        await assertOwnership();
        if (
          !(await this.pendingLoginRepository.complete(
            input.pendingLoginToken,
            reservationToken,
          ))
        ) {
          await this.authSessionRepository.revoke(result.session.session.sessionId);
          throw new ConflictException("pending_login_ownership_lost");
        }
        return result;
      }
      await assertOwnership();
      const session = await this.issueTemporarySession(input.pendingLoginToken, pending.expiresAt);
      await assertOwnership();
      if (
        !(await this.pendingLoginRepository.complete(
          input.pendingLoginToken,
          reservationToken,
        ))
      ) {
        await this.authSessionRepository.revoke(session.sessionId);
        throw new ConflictException("pending_login_ownership_lost");
      }
      return { kind: "temporary", session, temporaryHandle: session.sessionId };
    } catch (error) {
      await this.pendingLoginRepository.release(input.pendingLoginToken, reservationToken);
      throw error;
    }
  }

  async getSession(input: {
    accessToken?: string;
    temporaryToken?: string;
  }): Promise<AuthSessionSummary> {
    let sessionId = input.temporaryToken;
    if (input.accessToken) {
      try {
        sessionId = (await this.validateAccessToken(input.accessToken)).sid;
      } catch {
        return { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null };
      }
    }
    if (!sessionId) return { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null };
    const session = await this.authSessionRepository.findBySessionId(sessionId);
    if (
      !session ||
      session.revoked ||
      isExpired(session.expiresAt) ||
      (!input.accessToken && session.mode !== "temporary")
    ) {
      return { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null };
    }
    return { authenticated: true, canUsePersistentFeatures: session.mode === "persisted", requiresConsent: session.mode === "temporary", storageMode: session.mode, userId: session.userId };
  }

  async refreshSession(input: RefreshSessionRequest): Promise<RefreshSessionResult> {
    if (!input.refreshToken) throw new BadRequestException("refresh_token_missing");
    return this.rotateRefreshToken(input.refreshToken);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.authSessionRepository.revoke(sessionId);
  }

  async logout(input: LogoutRequest = {}): Promise<{ ok: true }> {
    let sessionId: string | undefined;
    if (input.accessToken) {
      try {
        sessionId = (await this.validateAccessToken(input.accessToken)).sid;
      } catch {
        // A malformed access token must not prevent refresh-token revocation.
      }
    }
    if (!sessionId && input.refreshToken) {
      try {
        const claims = this.verifyToken(input.refreshToken, true) as RefreshTokenClaims;
        const session = await this.authSessionRepository.findBySessionId(claims.sid);
        this.assertActiveSession(session);
        if (
          session.mode !== claims.mode ||
          (session.mode === "persisted" ? session.userId : session.pendingLoginId) !==
            claims.sub
        ) throw new UnauthorizedException("invalid_refresh_token");
        sessionId = session.sessionId;
      } catch {
        // Logout remains idempotent for stale or malformed cookies.
      }
    }
    if (!sessionId && input.temporaryToken) {
      const session = await this.authSessionRepository.findBySessionId(input.temporaryToken);
      if (
        session &&
        session.mode === "temporary" &&
        !session.revoked &&
        !isExpired(session.expiresAt)
      ) sessionId = session.sessionId;
    }
    if (sessionId) await this.revokeSession(sessionId);
    return { ok: true };
  }
}
