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
  private readonly memoryStateStore = new Map<string, StoredLoginState>();
  private readonly memoryLoginResultStore = new Map<string, LoginResultPayload>();

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly pendingLoginRepository: PendingLoginRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * @description SSO authorize 요청에 필요한 초기 payload를 생성합니다.
   * @returns clientId, loginUrl, redirectUri, state, nonce
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
      const ssoUserId =
        typeof userInfo.user_id === "string" ? userInfo.user_id : "";

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
        expiresAt: Date.now() + PENDING_LOGIN_TTL_SECONDS * 1000,
        ssoUserId,
        userEmail:
          typeof userInfo.user_email === "string" ? userInfo.user_email : undefined,
        userMobile:
          typeof userInfo.user_mbtlnum === "string" ? userInfo.user_mbtlnum : undefined,
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

  private buildRedisKey(state: string): string {
    return `auth:sso:state:${state}`;
  }

  private buildLoginResultKey(resultToken: string): string {
    return `auth:login-result:${resultToken}`;
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

  private parseLoginResult(rawValue: string): LoginResultPayload | null {
    try {
      return JSON.parse(rawValue) as LoginResultPayload;
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

  private async storeLoginResult(
    resultToken: string,
    payload: LoginResultPayload,
  ): Promise<void> {
    const redisClient = await this.getRedisClient();
    const resultKey = this.buildLoginResultKey(resultToken);

    if (redisClient) {
      await redisClient.set(
        resultKey,
        JSON.stringify(payload),
        "EX",
        LOGIN_RESULT_TTL_SECONDS,
      );
      return;
    }

    this.memoryLoginResultStore.set(resultKey, payload);
  }

  async consumeLoginResult(resultToken: string | undefined): Promise<LoginResultPayload> {
    if (!resultToken) {
      throw new BadRequestException("resultToken_is_required");
    }

    const redisClient = await this.getRedisClient();
    const resultKey = this.buildLoginResultKey(resultToken);

    if (redisClient) {
      const rawValue = await redisClient.get(resultKey);

      if (!rawValue) {
        throw new UnauthorizedException("resultToken_not_found_or_expired");
      }

      await redisClient.del(resultKey);

      const parsed = this.parseLoginResult(rawValue);
      if (!parsed) {
        throw new UnauthorizedException("resultToken_invalid_payload");
      }

      return parsed;
    }

    const stored = this.memoryLoginResultStore.get(resultKey);

    if (!stored) {
      throw new UnauthorizedException("resultToken_not_found_or_expired");
    }

    this.memoryLoginResultStore.delete(resultKey);
    return stored;
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
