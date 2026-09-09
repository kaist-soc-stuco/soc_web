import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ChannelTalkConfigResponse } from "@soc/contracts";
import { nowIso, expiresAtMs } from "@soc/shared";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./auth-session.service";
import { PendingLoginRepository } from "./pending-login.repository";
import { InitialAdminService } from "./initial-admin.service";
import { readResponseTextWithLimit } from "../../shared/http/bounded-fetch";

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

type LoginTransactionPayload =
  | { kind: "result"; result: LoginResultPayload }
  | { kind: "pending"; pendingLoginToken: string };

export interface LoginCallbackResult {
  redirectUrl: string;
  transactionToken?: string;
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
const LOGIN_TRANSACTION_RESULT_TTL_SECONDS = 60;
const LOGIN_TRANSACTION_PENDING_TTL_SECONDS = PENDING_LOGIN_TTL_SECONDS;

const isSsoApiErrorResponse = (
  value: SsoApiErrorResponse | SsoApiSuccessResponse,
): value is SsoApiErrorResponse => "error" in value || "errorCode" in value;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly startConfig: SsoConfig;
  private readonly callbackConfig: SsoCallbackConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly initialAdminService: InitialAdminService,
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

  async getChannelTalkConfig(
    userId?: string,
  ): Promise<ChannelTalkConfigResponse> {
    const pluginKey = this.configService
      .get<string>("CHANNELTALK_PLUGIN_KEY")
      ?.trim();

    if (!pluginKey) {
      return { enabled: false, language: "ko" };
    }

    const baseConfig: ChannelTalkConfigResponse = {
      enabled: true,
      language: "ko",
      pluginKey,
    };

    if (!userId) {
      return baseConfig;
    }

    const user = await this.usersService.findById(userId);
    const memberHashSecret = this.configService
      .get<string>("CHANNELTALK_MEMBER_HASH_SECRET")
      ?.trim();

    if (!user || !memberHashSecret) {
      return baseConfig;
    }

    if (
      !/^[0-9a-f]+$/i.test(memberHashSecret) ||
      memberHashSecret.length % 2 !== 0
    ) {
      this.logger.warn(
        "CHANNELTALK_MEMBER_HASH_SECRET is not a valid hexadecimal secret; using anonymous Channel Talk boot.",
      );
      return baseConfig;
    }

    const memberId = user.userId;
    const memberHash = createHmac(
      "sha256",
      Buffer.from(memberHashSecret, "hex"),
    )
      .update(memberId)
      .digest("hex");

    return {
      ...baseConfig,
      memberId,
      memberHash,
      profile: {
        email: user.email,
        name: user.nameKo,
      },
    };
  }

  /**
   * SSO callback 결과를 처리하고 다음 화면으로 redirect할 URL을 계산합니다.
   */
  async handleLoginCallback(
    body: CallbackBody,
    transactionCookie?: string,
  ): Promise<LoginCallbackResult> {
    if (!body.state) {
      return this.redirectResult("error", "missing_callback_params");
    }

    if (!transactionCookie || !this.safeEqual(body.state, transactionCookie)) {
      return this.redirectResult("error", "invalid_sso_transaction");
    }

    if (body.error || body.errorCode) {
      return this.redirectResult("error", "sso_authorize_failed");
    }

    if (!body.code) {
      return this.redirectResult("error", "missing_callback_params");
    }

    const config = this.readCallbackConfig();

    const stateKey = this.buildRedisKey(body.state);
    const storedState = await this.consumePendingState(stateKey);

    if (!storedState) {
      return this.redirectResult("error", "invalid_or_expired_state");
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
        signal: AbortSignal.timeout(15_000),
      });

      const parsedResponse = JSON.parse(await readResponseTextWithLimit(response, 512 * 1024)) as
        | SsoApiErrorResponse
        | SsoApiSuccessResponse;

      if (!response.ok) {
        return this.redirectResult("error", "sso_exchange_failed");
      }

      if (isSsoApiErrorResponse(parsedResponse) && parsedResponse.errorCode) {
        return this.redirectResult("error", "sso_exchange_failed");
      }

      if (isSsoApiErrorResponse(parsedResponse)) {
        return this.redirectResult("error", "sso_exchange_failed");
      }

      if (parsedResponse.nonce !== storedState.nonce) {
        return this.redirectResult("error", "nonce_mismatch");
      }

      const userInfo = this.normalizeUserInfo(parsedResponse.userInfo);
      const ssoSubject = this.readRequiredUserInfoString(
        userInfo,
        "user_id",
        "missing_user_id",
      );
      const kaistUid = this.readRequiredUserInfoString(
        userInfo,
        "kaist_uid",
        "missing_kaist_uid",
      );
      const userEmail =
        this.readUserInfoString(userInfo, "email") ??
        this.readUserInfoString(userInfo, "user_email");
      const nameKo = this.readRequiredUserInfoString(
        userInfo,
        "user_nm",
        "missing_user_nm",
      );
      const nameEn = this.readUserInfoString(userInfo, "user_eng_nm");
      const stdNo = this.readUserInfoString(userInfo, "std_no");
      const departmentKo = this.readUserInfoString(userInfo, "std_dept_kor_nm");
      const departmentEn = this.readUserInfoString(userInfo, "std_dept_eng_nm");
      const primaryMajor =
        this.readUserInfoString(userInfo, "std_major_kor_nm") ??
        this.readUserInfoString(userInfo, "major_kor");
      const gender =
        this.readUserInfoString(userInfo, "gender") ??
        this.readUserInfoString(userInfo, "gender_cd");
      const academicStatus = this.readUserInfoString(userInfo, "std_status_kor");
      const identityCode = this.readUserInfoString(userInfo, "socps_cd");
      const userMobile = this.readUserInfoString(userInfo, "user_mbtlnum");

      if (!userEmail) {
        return this.redirectResult("error", "missing_email");
      }

      const existingUser = await this.usersService.findByKaistUid(kaistUid);

      if (existingUser) {
        if (!existingUser.isActive) {
          return this.redirectResult("error", "account_expired");
        }

        if (nameKo || nameEn || userEmail) {
          await this.usersService.updateProfileFromSso(existingUser.userId, {
            academicStatus,
            departmentEn,
            departmentKo,
            primaryMajor,
            gender,
            email: userEmail,
            identityCode,
            nameEn,
            nameKo,
            stdNo,
            userMobile,
          });
        }

        await this.initialAdminService.ensureRoleForUser(
          existingUser.userId,
          stdNo,
        );

        const issued = await this.authSessionService.issuePersistedSession(
          existingUser.userId,
        );

        // 로그인 직후에 권한 캐시가 오래된 값을 가지고 있을 수 있으므로 무효화합니다.
        await this.usersService.invalidatePermissionCache(existingUser.userId);

        const transactionToken = randomUUID();
        await this.storeLoginTransaction(
          transactionToken,
          {
            kind: "result",
            result: {
              accessToken: issued.accessToken,
              refreshToken: issued.refreshToken,
              sessionId: issued.session.sessionId,
              storageMode: "persisted",
              userId: existingUser.userId,
            },
          },
          LOGIN_TRANSACTION_RESULT_TTL_SECONDS,
        );

        return {
          redirectUrl: this.buildFrontendRedirect("success", "ok"),
          transactionToken,
        };
      }

      const pendingLoginToken = randomUUID();
      await this.pendingLoginRepository.save(pendingLoginToken, {
        academicStatus,
        departmentEn,
        departmentKo,
        expiresAt: expiresAtMs(PENDING_LOGIN_TTL_SECONDS),
        email: userEmail,
        identityCode,
        kaistUid,
        nameEn,
        nameKo,
        ssoSubject,
        stdNo,
        primaryMajor,
        gender,
        userMobile,
      }, PENDING_LOGIN_TTL_SECONDS);

      const transactionToken = randomUUID();
      await this.storeLoginTransaction(
        transactionToken,
        { kind: "pending", pendingLoginToken },
        LOGIN_TRANSACTION_PENDING_TTL_SECONDS,
      );

      return {
        redirectUrl: this.buildFrontendRedirect(
          "consent-required",
          "pending_consent",
        ),
        transactionToken,
      };
    } catch (error) {
      this.logger.warn(
        `SSO callback failed: ${error instanceof Error ? error.name : "unknown_error"}`,
      );
      return this.redirectResult("error", "sso_exchange_failed");
    }
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private redirectResult(
    status: "consent-required" | "error" | "success",
    reason: string,
  ): LoginCallbackResult {
    return { redirectUrl: this.buildFrontendRedirect(status, reason) };
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

  /** 로그인 완료 transaction용 Redis 키를 생성합니다. */
  private buildLoginTransactionKey(transactionToken: string): string {
    return `auth:login-transaction:${transactionToken}`;
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

  /** userInfo에서 비어 있지 않은 문자열만 꺼냅니다. */
  private readUserInfoString(
    userInfo: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = userInfo[key];

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readRequiredUserInfoString(
    userInfo: Record<string, unknown>,
    key: string,
    reason: string,
  ): string {
    const value = this.readUserInfoString(userInfo, key);

    if (!value) {
      throw new BadRequestException(reason);
    }

    return value;
  }

  /** Redis에 저장된 state payload를 안전하게 파싱합니다. */
  private parseStoredState(rawValue: string): StoredLoginState | null {
    try {
      return JSON.parse(rawValue) as StoredLoginState;
    } catch {
      return null;
    }
  }

  /** Redis에 저장된 로그인 transaction payload를 안전하게 파싱합니다. */
  private parseLoginTransaction(
    rawValue: string,
  ): LoginTransactionPayload | null {
    try {
      const parsed = JSON.parse(rawValue) as LoginTransactionPayload;
      if (parsed.kind === "result" && parsed.result?.accessToken) return parsed;
      if (parsed.kind === "pending" && parsed.pendingLoginToken) return parsed;
      return null;
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

  /** Redis에서 state를 원자적으로 소비하고 저장 payload로 역직렬화합니다. */
  private async consumePendingState(
    stateKey: string,
  ): Promise<StoredLoginState | null> {
    const rawValue = await this.consumeRedisValueOnce(stateKey);
    return rawValue ? this.parseStoredState(rawValue) : null;
  }

  /** 로그인 완료 후 쿠키 세팅 전까지의 transaction을 Redis에 저장합니다. */
  private async storeLoginTransaction(
    transactionToken: string,
    payload: LoginTransactionPayload,
    ttlSeconds: number,
  ): Promise<void> {
    const transactionKey = this.buildLoginTransactionKey(transactionToken);

    await this.redis.set(
      transactionKey,
      JSON.stringify(payload),
      "EX",
      ttlSeconds,
    );
  }

  /** Redis GETDEL로 값을 원자적으로 1회만 소비합니다. */
  private async consumeRedisValueOnce(key: string): Promise<string | null> {
    return this.redis.getdel(key);
  }

  /** HttpOnly transaction cookie로 로그인 결과를 1회 소비합니다. */
  async consumeLoginResult(
    transactionToken: string | undefined,
  ): Promise<LoginResultPayload> {
    if (!transactionToken) {
      throw new BadRequestException("login_transaction_required");
    }

    const rawValue = await this.consumeRedisValueOnce(
      this.buildLoginTransactionKey(transactionToken),
    );

    if (!rawValue) {
      throw new UnauthorizedException("login_transaction_not_found_or_expired");
    }

    const parsed = this.parseLoginTransaction(rawValue);
    if (!parsed || parsed.kind !== "result") {
      throw new UnauthorizedException("login_transaction_invalid_payload");
    }

    return parsed.result;
  }

  /** consent 화면에서만 pending token을 서버 내부에서 꺼냅니다. */
  async getPendingLoginToken(
    transactionToken: string | undefined,
  ): Promise<string> {
    if (!transactionToken) {
      throw new BadRequestException("login_transaction_required");
    }

    const rawValue = await this.redis.get(
      this.buildLoginTransactionKey(transactionToken),
    );
    const parsed = rawValue ? this.parseLoginTransaction(rawValue) : null;

    if (!parsed || parsed.kind !== "pending") {
      throw new UnauthorizedException("login_transaction_not_found_or_expired");
    }

    return parsed.pendingLoginToken;
  }

  async clearLoginTransaction(transactionToken?: string): Promise<void> {
    if (transactionToken) {
      await this.redis.del(this.buildLoginTransactionKey(transactionToken));
    }
  }

  /** 프런트가 login/start에 쓰는 SSO 기본 설정을 구성합니다. */
  private loadStartConfig(): SsoConfig {
    return {
      clientId: this.ensureRequired(
        this.configService.get<string>("SSO_CLIENT_ID"),
        "SSO_CLIENT_ID",
      ),
      loginUrl: this.ensureRequired(
        this.configService.get<string>("SSO_LOGIN_URL"),
        "SSO_LOGIN_URL",
      ),
      redirectUri: this.ensureRequired(
        this.configService.get<string>("SSO_REDIRECT_URI"),
        "SSO_REDIRECT_URI",
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
