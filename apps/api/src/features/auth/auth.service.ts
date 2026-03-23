import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';

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

const isSsoApiErrorResponse = (
  value: SsoApiErrorResponse | SsoApiSuccessResponse,
): value is SsoApiErrorResponse => "error" in value || "errorCode" in value;

@Injectable()
export class AuthService {
  private readonly memoryStateStore = new Map<string, StoredLoginState>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * @description SSO authorize 요청에 필요한 초기 payload를 생성합니다.
   * @returns clientId, loginUrl, redirectUri, state, nonce
   *
   * TODO:
   * - consent flow 도입 후에는 이 payload에 추적용 `pendingLoginId`를 연결할지 검토하세요.
   * - Redis 저장 시 temporary/persisted 후보를 식별할 수 있는 메타데이터를 함께 넣는 방향이 좋습니다.
   */
  async createLoginStartPayload(): Promise<LoginStartPayload> {
    const config = this.readStartConfig();
    const state = randomUUID();
    const nonce = randomUUID();

    await this.storePendingState(state, {
      nonce,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
    });

    return {
      ...config,
      nonce,
      state,
    };
  }

  /**
   * @description SSO callback 결과를 처리하고 다음 화면으로 redirect할 URL을 계산합니다.
   * @returns `/login?...` 형식의 redirect URL
   *
   * TODO:
   * - 현재는 userInfo 교환 후 redirect만 합니다.
   * - 앞으로는 여기서
   *   1) PostgreSQL 사용자 조회
   *   2) 기존 사용자면 access/refresh 발급
   *   3) 신규 사용자면 pending consent 상태 저장
   *   로 분기시키세요.
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

    await this.deletePendingState(stateKey);

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
        return this.buildFrontendRedirect("error", "nonce_mismatch");
      }

      const userInfo = this.normalizeUserInfo(parsedResponse.userInfo);
      const userId =
        typeof userInfo.user_id === "string"
          ? userInfo.user_id
          : "unknown-user";

      return this.buildFrontendRedirect("success", "ok", { userId });
    } catch (error) {
      return this.buildFrontendRedirect(
        "error",
        error instanceof Error ? error.message : "sso_exchange_failed",
      );
    }
  }

  private buildFrontendRedirect(
    status: "error" | "success",
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

  private buildRedisKey(state: string): string {
    return `auth:sso:state:${state}`;
  }

  private ensureRequired(value: string | undefined, name: string): string {
    if (value && value.trim().length > 0) {
      return value;
    }

    throw new InternalServerErrorException(
      `Missing environment variable: ${name}`,
    );
  }

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

  private parseStoredState(rawValue: string): StoredLoginState | null {
    try {
      return JSON.parse(rawValue) as StoredLoginState;
    } catch {
      return null;
    }
  }

  private async storePendingState(
    state: string,
    payload: StoredLoginState,
  ): Promise<void> {
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      await redisClient.set(
        this.buildRedisKey(state),
        JSON.stringify(payload),
        "EX",
        STATE_TTL_SECONDS,
      );
      return;
    }

    this.memoryStateStore.set(this.buildRedisKey(state), payload);
  }

  private async readPendingState(
    stateKey: string,
  ): Promise<StoredLoginState | null> {
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      const rawValue = await redisClient.get(stateKey);
      return rawValue ? this.parseStoredState(rawValue) : null;
    }

    const payload = this.memoryStateStore.get(stateKey);

    if (!payload) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      this.memoryStateStore.delete(stateKey);
      return null;
    }

    return payload;
  }

  private async deletePendingState(stateKey: string): Promise<void> {
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      await redisClient.del(stateKey);
      return;
    }

    this.memoryStateStore.delete(stateKey);
  }

  private readStartConfig(): SsoConfig {
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

  private readCallbackConfig(): SsoCallbackConfig {
    return {
      ...this.readStartConfig(),
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

  private async getRedisClient(): Promise<Redis | null> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }

      if (this.redis.status === "ready" || this.redis.status === "connect") {
        return this.redis;
      }
    } catch {
      return null;
    }

    return null;
  }
}
