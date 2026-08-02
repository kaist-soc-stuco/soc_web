import {
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { nowIso, expiresAtMs } from "@soc/shared";

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';
import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./auth-session.service";
import { PendingLoginRepository } from "./pending-login.repository";
import { AuthStateRepository } from "./auth-state.repository";
import type { AuthoritativeSsoProfile, LoginCallbackResult } from "./auth.types";

interface SsoConfig {
  clientId: string;
  loginUrl: string;
  redirectUri: string;
}

interface SsoCallbackConfig extends SsoConfig {
  authApiUrl: string;
  clientSecret: string;
}

interface StoredLoginState {
  createdAt: string;
  expiresAt: number;
  nonce: string;
  bindingHash: string;
}

interface LoginStartPayload extends SsoConfig {
  nonce: string;
  state: string;
  transactionSecret: string;
}


interface CallbackBody {
  code?: string;
  error?: string;
  errorCode?: string;
  state?: string;
}


const STATE_TTL_SECONDS = 300;
const PENDING_LOGIN_TTL_SECONDS = 10 * 60;
const SSO_EXCHANGE_TIMEOUT_MS = 5_000;

const isSsoApiResponse = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSsoApiErrorResponse = (
  value: Record<string, unknown>,
): boolean => "error" in value || "errorCode" in value;

@Injectable()
export class AuthService {
  private readonly startConfig: SsoConfig;
  private readonly callbackConfig: SsoCallbackConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly authStateRepository: AuthStateRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.startConfig = this.loadStartConfig();
    this.callbackConfig = this.loadCallbackConfig(this.startConfig);
  }

  /**
    * SSO authorize 요청에 필요한 초기 payload를 생성합니다.
   */
  async createLoginStartPayload(): Promise<LoginStartPayload> {
    const config = this.readStartConfig();
    const state = randomUUID();
    const nonce = randomUUID();
    const transactionSecret = randomBytes(32).toString("base64url");

    await this.storePendingState(state, {
      nonce,
      createdAt: nowIso(),
      expiresAt: expiresAtMs(STATE_TTL_SECONDS),
      bindingHash: this.hashBinding(transactionSecret),
    });

    return {
      ...config,
      nonce,
      state,
      transactionSecret,
    };
  }

  /**
    * SSO callback 결과를 처리하고 다음 화면으로 redirect할 URL을 계산합니다.
   */
  async handleLoginCallback(body: CallbackBody, transactionSecret?: string): Promise<LoginCallbackResult> {
    if (body.error || body.errorCode) {
      throw new UnauthorizedException("sso_authorize_failed");
    }
    if (!body.state || !body.code || !transactionSecret) {
      throw new UnauthorizedException("invalid_or_expired_state");
    }

    const rawState = await this.authStateRepository.compareAndDelete(
      this.buildRedisKey(body.state),
      this.hashBinding(transactionSecret),
    );
    const storedState = rawState ? this.parseStoredState(rawState) : null;
    if (!storedState || storedState.expiresAt <= Date.now()) {
      throw new UnauthorizedException("invalid_or_expired_state");
    }

    const config = this.readCallbackConfig();
    let response: Response;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), SSO_EXCHANGE_TIMEOUT_MS);
    try {
      response = await fetch(config.authApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: body.code,
          redirect_uri: config.redirectUri,
        }).toString(),
        signal: abortController.signal,
      });
    } catch {
      throw new UnauthorizedException("sso_exchange_failed");
    } finally {
      clearTimeout(timeout);
    }

    let parsedResponse: unknown;
    try {
      let jsonTimeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        jsonTimeout = setTimeout(() => reject(new Error("sso response timeout")), SSO_EXCHANGE_TIMEOUT_MS);
      });
      try {
        parsedResponse = await Promise.race([response.json(), timeoutPromise]);
      } finally {
        if (jsonTimeout) clearTimeout(jsonTimeout);
      }
    } catch {
      throw new UnauthorizedException("sso_exchange_failed");
    }
    if (
      !response.ok ||
      !isSsoApiResponse(parsedResponse) ||
      isSsoApiErrorResponse(parsedResponse)
    ) {
      throw new UnauthorizedException("sso_exchange_failed");
    }
    if (parsedResponse.nonce !== storedState.nonce) {
      throw new UnauthorizedException("nonce_mismatch");
    }

    const profile = this.normalizeAuthoritativeProfile(parsedResponse.userInfo);
    const existingUser = await this.usersService.findBySsoUserId(profile.ssoSubject);
    if (existingUser) {
      let synchronized;
      try {
        synchronized = await this.usersService.synchronizeProductionSsoProfile({
          expectedUserId: existingUser.id,
          kaistUid: profile.kaistUid,
          nameEn: profile.nameEn,
          nameKr: profile.nameKr,
          ssoSubject: profile.ssoSubject,
          studentOrEmployeeNumber: profile.studentOrEmployeeNumber,
          userEmail: profile.userEmail,
        });
      } catch {
        throw new UnauthorizedException("sso_identity_conflict");
      }
      const session = await this.authSessionService.issuePersistedSession(synchronized.id);
      return { kind: "persisted", session, userId: synchronized.id };
    }

    const flowToken = randomUUID();
    await this.pendingLoginRepository.save(flowToken, {
      ...profile,
      expiresAt: expiresAtMs(PENDING_LOGIN_TTL_SECONDS),
    }, PENDING_LOGIN_TTL_SECONDS);
    return { kind: "consent_required", flowToken };
  }


  /** SSO state 저장용 Redis 키를 생성합니다. */
  private buildRedisKey(state: string): string {
    return `auth:sso:state:${state}`;
  }


  /** 필수 환경변수가 비어 있으면 예외를 발생시킵니다. */
  private ensureRequired(value: string | undefined, name: string): string {
    if (value && value.trim().length > 0) {
      return value;
    }

    throw new InternalServerErrorException(
      `Missing environment variable: ${name}`,
    );
  }

  /** SSO userInfo가 문자열(JSON)로 와도 객체 형태로 정규화합니다. */
  private normalizeUserInfo(
    userInfo: unknown,
  ): Record<string, unknown> {
    if (!userInfo) {
      return {};
    }

    if (typeof userInfo === "string") {
      try {
        const parsed: unknown = JSON.parse(userInfo);
        return isSsoApiResponse(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    return isSsoApiResponse(userInfo) ? userInfo : {};
  }

  private normalizeAuthoritativeProfile(userInfo: unknown): AuthoritativeSsoProfile {
    const normalized = this.normalizeUserInfo(userInfo);
    const required = (key: string): string => {
      const value = normalized[key];
      if (typeof value !== "string" || !value.trim()) {
        throw new UnauthorizedException("invalid_sso_profile");
      }
      return value.trim();
    };
    const studentNumber = typeof normalized.std_no === "string" ? normalized.std_no.trim() : "";
    const employeeNumber = typeof normalized.emp_no === "string" ? normalized.emp_no.trim() : "";
    if (Boolean(studentNumber) === Boolean(employeeNumber)) {
      throw new UnauthorizedException("invalid_sso_profile");
    }
    const userEmail = required("user_email").toLowerCase();
    if (!/^[^@\s]+@kaist\.ac\.kr$/i.test(userEmail)) {
      throw new UnauthorizedException("invalid_sso_profile");
    }
    return {
      kaistUid: required("kaist_uid"),
      nameEn: required("user_eng_nm"),
      nameKr: required("user_nm"),
      ssoSubject: required("user_id"),
      studentOrEmployeeKind: studentNumber ? "STUDENT" : "EMPLOYEE",
      studentOrEmployeeNumber: studentNumber || employeeNumber,
      userEmail,
    };
  }

  /** Redis에 저장된 state payload를 안전하게 파싱합니다. */
  private parseStoredState(rawValue: string): StoredLoginState | null {
    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredLoginState>;
      if (
        typeof parsed.createdAt !== "string" ||
        typeof parsed.expiresAt !== "number" ||
        !Number.isFinite(parsed.expiresAt) ||
        typeof parsed.nonce !== "string" ||
        !parsed.nonce
      ) {
        return null;
      }
      return parsed as StoredLoginState;
    } catch {
      return null;
    }
  }
  private hashBinding(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }


  /** state와 nonce를 TTL과 함께 Redis에 저장합니다. */
  private async storePendingState(
    state: string,
    payload: StoredLoginState,
  ): Promise<void> {
    await this.redis.set(
      this.buildRedisKey(state),
      JSON.stringify(payload),
      "EX",
      STATE_TTL_SECONDS,
    );
  }



  /** 프런트가 login/start에 쓰는 SSO 기본 설정을 구성합니다. */
  private loadStartConfig(): SsoConfig {
    return {
      clientId: this.ensureRequired(
        this.configService.get<string>("VITE_SSO_CLIENT_ID"),
        "VITE_SSO_CLIENT_ID",
      ),
      loginUrl: this.ensureRequired(
        this.configService.get<string>("VITE_SSO_LOGIN_URL"),
        "VITE_SSO_LOGIN_URL",
      ),
      redirectUri: this.ensureRequired(
        this.configService.get<string>("VITE_SSO_REDIRECT_URI"),
        "VITE_SSO_REDIRECT_URI",
      ),
    };
  }

  /** callback 처리에 필요한 서버 측 SSO 설정을 구성합니다. */
  private loadCallbackConfig(startConfig: SsoConfig): SsoCallbackConfig {
    return {
      ...startConfig,
      authApiUrl: this.ensureRequired(
        this.configService.get<string>("SSO_AUTH_API_URL"),
        "SSO_AUTH_API_URL",
      ),
      clientSecret: this.ensureRequired(
        this.configService.get<string>("SSO_CLIENT_SECRET"),
        "SSO_CLIENT_SECRET",
      ),
    };
  }

  /** 캐시된 login/start 설정을 읽습니다. */
  private readStartConfig(): SsoConfig {
    return this.startConfig;
  }

  /** 캐시된 callback 설정을 읽습니다. */
  private readCallbackConfig(): SsoCallbackConfig {
    return this.callbackConfig;
  }
}
