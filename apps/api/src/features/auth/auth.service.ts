import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { nowIso, expiresAtMs } from "@soc/shared";

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';
import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./auth-session.service";
import { PendingLoginRepository } from "./pending-login.repository";

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
}

interface LoginStartPayload extends SsoConfig {
  nonce: string;
  state: string;
}

interface LoginResultPayload {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  storageMode: "persisted" | "temporary";
  userId?: string;
}

interface CallbackBody {
  code?: string;
  error?: string;
  errorCode?: string;
  state?: string;
}

interface SsoApiSuccessResponse {
  nonce?: string;
  userInfo?: Record<string, unknown> | string;
}

interface SsoApiErrorResponse {
  error?: string;
  errorCode?: string;
}

const STATE_TTL_SECONDS = 300;
const PENDING_LOGIN_TTL_SECONDS = 10 * 60;
const LOGIN_RESULT_TTL_SECONDS = 60;

const isSsoApiErrorResponse = (
  value: SsoApiErrorResponse | SsoApiSuccessResponse,
): value is SsoApiErrorResponse => "error" in value || "errorCode" in value;

@Injectable()
export class AuthService {
  private readonly startConfig: SsoConfig;
  private readonly callbackConfig: SsoCallbackConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly pendingLoginRepository: PendingLoginRepository,
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

    await this.storePendingState(state, {
      nonce,
      createdAt: nowIso(),
      expiresAt: expiresAtMs(STATE_TTL_SECONDS),
    });

    return {
      ...config,
      nonce,
      state,
    };
  }

  /**
    * SSO callback 결과를 처리하고 다음 화면으로 redirect할 URL을 계산합니다.
   */
  async handleLoginCallback(body: CallbackBody): Promise<string> {
    if (body.error || body.errorCode) {
      return this.buildFrontendRedirect(
        "error",
        body.errorCode ?? body.error ?? "sso_authorize_failed",
      );
    }

    if (!body.state || !body.code) {
      return this.buildFrontendRedirect("error", "missing_callback_params");
    }

    const config = this.readCallbackConfig();

    const stateKey = this.buildRedisKey(body.state);
    const storedState = await this.readPendingState(stateKey);

    if (!storedState) {
      return this.buildFrontendRedirect("error", "invalid_or_expired_state");
    }

    try {
      const response = await fetch(config.authApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: body.code,
          redirect_uri: config.redirectUri,
        }).toString(),
      });

      const parsedResponse = (await response.json()) as
        | SsoApiErrorResponse
        | SsoApiSuccessResponse;

      if (!response.ok) {
        const failureReason = isSsoApiErrorResponse(parsedResponse)
          ? (parsedResponse.errorCode ??
            parsedResponse.error ??
            `http_${response.status}`)
          : `http_${response.status}`;

        return this.buildFrontendRedirect("error", failureReason);
      }

      if (isSsoApiErrorResponse(parsedResponse) && parsedResponse.errorCode) {
        return this.buildFrontendRedirect("error", parsedResponse.errorCode);
      }

      if (isSsoApiErrorResponse(parsedResponse)) {
        return this.buildFrontendRedirect(
          "error",
          parsedResponse.error ??
            parsedResponse.errorCode ??
            "sso_exchange_failed",
        );
      }

      if (parsedResponse.nonce !== storedState.nonce) {
        await this.deletePendingState(stateKey);
        return this.buildFrontendRedirect("error", "nonce_mismatch");
      }

      await this.deletePendingState(stateKey);

      const userInfo = this.normalizeUserInfo(parsedResponse.userInfo);
      const ssoUserId =
        typeof userInfo.user_id === "string" ? userInfo.user_id : "";
      const userEmail =
        typeof userInfo.user_email === "string" && userInfo.user_email.trim().length > 0
          ? userInfo.user_email
          : undefined;
      const userMobile =
        typeof userInfo.user_mbtlnum === "string" && userInfo.user_mbtlnum.trim().length > 0
          ? userInfo.user_mbtlnum
          : undefined;

      if (!ssoUserId) {
        return this.buildFrontendRedirect("error", "missing_sso_user_id");
      }

      const existingUser = await this.usersService.findBySsoUserId(ssoUserId);

      if (existingUser) {
        const issued = await this.authSessionService.issuePersistedSession(
          existingUser.id,
        );

        const resultToken = randomUUID();
        await this.storeLoginResult(resultToken, {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          sessionId: issued.session.sessionId,
          storageMode: "persisted",
          userId: existingUser.id,
        });

        return this.buildFrontendRedirect("success", "ok", {
          resultToken,
          storageMode: "persisted",
          userId: existingUser.id,
        });
      }

      const pendingLoginToken = randomUUID();
      await this.pendingLoginRepository.save(pendingLoginToken, {
        expiresAt: expiresAtMs(PENDING_LOGIN_TTL_SECONDS),
        ssoUserId,
        userEmail,
        userMobile,
      }, PENDING_LOGIN_TTL_SECONDS);

      return this.buildFrontendRedirect("consent-required", "pending_consent", {
        pendingLoginToken,
      });
    } catch (error) {
      return this.buildFrontendRedirect(
        "error",
        error instanceof Error ? error.message : "sso_exchange_failed",
      );
    }
  }

  /** 프런트 로그인 페이지로 상태/사유를 담아 redirect URL을 생성합니다. */
  private buildFrontendRedirect(
    status: "consent-required" | "error" | "success",
    reason: string,
    extraParams?: Record<string, string>,
  ): string {
    const searchParams = new URLSearchParams({
      status,
      reason,
      ...extraParams,
    });

    return `/login?${searchParams.toString()}`;
  }

  /** SSO state 저장용 Redis 키를 생성합니다. */
  private buildRedisKey(state: string): string {
    return `auth:sso:state:${state}`;
  }

  /** 로그인 결과 1회 소비 토큰용 Redis 키를 생성합니다. */
  private buildLoginResultKey(resultToken: string): string {
    return `auth:login-result:${resultToken}`;
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
    userInfo: Record<string, unknown> | string | undefined,
  ): Record<string, unknown> {
    if (!userInfo) {
      return {};
    }

    if (typeof userInfo === "string") {
      try {
        return JSON.parse(userInfo) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    return userInfo;
  }

  /** Redis에 저장된 state payload를 안전하게 파싱합니다. */
  private parseStoredState(rawValue: string): StoredLoginState | null {
    try {
      return JSON.parse(rawValue) as StoredLoginState;
    } catch {
      return null;
    }
  }

  /** Redis에 저장된 로그인 결과 payload를 안전하게 파싱합니다. */
  private parseLoginResult(rawValue: string): LoginResultPayload | null {
    try {
      return JSON.parse(rawValue) as LoginResultPayload;
    } catch {
      return null;
    }
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

  /** Redis에서 state를 조회하고 저장 payload로 역직렬화합니다. */
  private async readPendingState(
    stateKey: string,
  ): Promise<StoredLoginState | null> {
    const rawValue = await this.redis.get(stateKey);
    return rawValue ? this.parseStoredState(rawValue) : null;
  }

  /** 사용한 state를 Redis에서 제거합니다. */
  private async deletePendingState(stateKey: string): Promise<void> {
    await this.redis.del(stateKey);
  }

  /** 로그인 완료 후 쿠키 세팅 전까지의 결과를 Redis에 임시 저장합니다. */
  private async storeLoginResult(
    resultToken: string,
    payload: LoginResultPayload,
  ): Promise<void> {
    const resultKey = this.buildLoginResultKey(resultToken);

    await this.redis.set(
      resultKey,
      JSON.stringify(payload),
      "EX",
      LOGIN_RESULT_TTL_SECONDS,
    );
  }

  /** Redis GETDEL로 값을 원자적으로 1회만 소비합니다. */
  private async consumeRedisValueOnce(key: string): Promise<string | null> {
    return this.redis.getdel(key);
  }

  /** resultToken으로 로그인 결과를 1회 소비하고 payload를 반환합니다. */
  async consumeLoginResult(resultToken: string | undefined): Promise<LoginResultPayload> {
    if (!resultToken) {
      throw new BadRequestException("resultToken_is_required");
    }

    const resultKey = this.buildLoginResultKey(resultToken);

    const rawValue = await this.consumeRedisValueOnce(resultKey);

    if (!rawValue) {
      throw new UnauthorizedException("resultToken_not_found_or_expired");
    }

    const parsed = this.parseLoginResult(rawValue);
    if (!parsed) {
      throw new UnauthorizedException("resultToken_invalid_payload");
    }

    return parsed;
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
