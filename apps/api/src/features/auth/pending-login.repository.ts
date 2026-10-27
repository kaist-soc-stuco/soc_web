import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import { AuthPayloadCipher } from "./auth-payload-crypto";
import type { PendingSsoUser } from "./auth.types";

const PENDING_LOGIN_PREFIX = "auth:pending-login:";

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isPendingSsoUser = (value: unknown): value is PendingSsoUser => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<Record<keyof PendingSsoUser, unknown>>;
  return (
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt) &&
    typeof payload.ssoSubject === "string" &&
    typeof payload.kaistUid === "string" &&
    typeof payload.nameKo === "string" &&
    typeof payload.email === "string" &&
    isOptionalString(payload.nameEn) &&
    isOptionalString(payload.stdNo) &&
    isOptionalString(payload.departmentKo) &&
    isOptionalString(payload.departmentEn) &&
    isOptionalString(payload.primaryMajor) &&
    isOptionalString(payload.academicStatus) &&
    isOptionalString(payload.identityCode)
  );
};

@Injectable()
export class PendingLoginRepository {
  private readonly cipher: AuthPayloadCipher;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.cipher = new AuthPayloadCipher(
      this.readEncryptionSecret(),
      "pending-login",
    );
  }

  private buildKey(pendingLoginToken: string): string {
    return `${PENDING_LOGIN_PREFIX}${pendingLoginToken}`;
  }

  private readEncryptionSecret(): string {
    const encryptionSeed = this.configService.get<string>(
      "AUTH_PENDING_LOGIN_ENCRYPTION_KEY",
    );

    if (!encryptionSeed) {
      throw new InternalServerErrorException(
        "AUTH_PENDING_LOGIN_ENCRYPTION_KEY_is_required",
      );
    }

    return encryptionSeed;
  }

  private parse(rawValue: string): PendingSsoUser | null {
    const parsed = this.cipher.decrypt(rawValue);
    return isPendingSsoUser(parsed) ? parsed : null;
  }

  async save(
    pendingLoginToken: string,
    payload: PendingSsoUser,
    ttlSeconds: number,
  ): Promise<void> {
    const pendingKey = this.buildKey(pendingLoginToken);

    await this.redis.set(
      pendingKey,
      this.cipher.encrypt(payload),
      "EX",
      ttlSeconds,
    );
  }

  async find(pendingLoginToken: string): Promise<PendingSsoUser | null> {
    const pendingKey = this.buildKey(pendingLoginToken);
    const rawValue = await this.redis.get(pendingKey);
    return rawValue ? this.parse(rawValue) : null;
  }

  /** Redis GETDEL makes consent a one-time decision under concurrent submits. */
  async consume(pendingLoginToken: string): Promise<PendingSsoUser | null> {
    const pendingKey = this.buildKey(pendingLoginToken);
    const rawValue = await this.redis.getdel(pendingKey);
    return rawValue ? this.parse(rawValue) : null;
  }

  async delete(pendingLoginToken: string): Promise<void> {
    const pendingKey = this.buildKey(pendingLoginToken);
    await this.redis.del(pendingKey);
  }
}
