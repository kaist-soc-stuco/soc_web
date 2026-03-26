import {
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import type { PendingSsoUser } from "./auth.types";

const PENDING_LOGIN_PREFIX = "auth:pending-login:";

interface StoredPendingSsoUser {
  encryptedUserEmail?: string;
  encryptedUserMobile?: string;
  expiresAt: number;
  ssoUserId: string;
}

@Injectable()
export class PendingLoginRepository {
  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private buildKey(pendingLoginToken: string): string {
    return `${PENDING_LOGIN_PREFIX}${pendingLoginToken}`;
  }

  private getEncryptionKey(): Buffer {
    const encryptionSeed = this.configService.get<string>(
      "AUTH_PENDING_LOGIN_ENCRYPTION_KEY",
    );

    if (!encryptionSeed) {
      throw new InternalServerErrorException(
        "AUTH_PENDING_LOGIN_ENCRYPTION_KEY_is_required",
      );
    }

    return createHash("sha256").update(encryptionSeed).digest();
  }

  private encrypt(plainText: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decrypt(cipherText: string): string {
    const [ivRaw, authTagRaw, encryptedRaw] = cipherText.split(".");

    if (!ivRaw || !authTagRaw || !encryptedRaw) {
      throw new InternalServerErrorException("pending_login_payload_corrupted");
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivRaw, "base64url");
    const authTag = Buffer.from(authTagRaw, "base64url");
    const encrypted = Buffer.from(encryptedRaw, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);

    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }

  private serialize(payload: PendingSsoUser): StoredPendingSsoUser {
    return {
      encryptedUserEmail: payload.userEmail
        ? this.encrypt(payload.userEmail)
        : undefined,
      encryptedUserMobile: payload.userMobile
        ? this.encrypt(payload.userMobile)
        : undefined,
      expiresAt: payload.expiresAt,
      ssoUserId: payload.ssoUserId,
    };
  }

  private parse(rawValue: string): PendingSsoUser | null {
    try {
      const parsed = JSON.parse(rawValue) as StoredPendingSsoUser;

      return {
        expiresAt: parsed.expiresAt,
        ssoUserId: parsed.ssoUserId,
        userEmail: parsed.encryptedUserEmail
          ? this.decrypt(parsed.encryptedUserEmail)
          : undefined,
        userMobile: parsed.encryptedUserMobile
          ? this.decrypt(parsed.encryptedUserMobile)
          : undefined,
      };
    } catch {
      return null;
    }
  }

  private async getRedisClient(): Promise<Redis> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }

      if (this.redis.status === "ready" || this.redis.status === "connect") {
        return this.redis;
      }
    } catch (error) {
      throw new ServiceUnavailableException(
        `redis_unavailable:${error instanceof Error ? error.message : "connect_failed"}`,
      );
    }

    throw new ServiceUnavailableException(
      `redis_unavailable:status_${this.redis.status}`,
    );
  }

  async save(pendingLoginToken: string, payload: PendingSsoUser, ttlSeconds: number): Promise<void> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);
    await redisClient.set(
      pendingKey,
      JSON.stringify(this.serialize(payload)),
      "EX",
      ttlSeconds,
    );
  }

  async find(pendingLoginToken: string): Promise<PendingSsoUser | null> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);
    const rawValue = await redisClient.get(pendingKey);
    return rawValue ? this.parse(rawValue) : null;
  }

  async delete(pendingLoginToken: string): Promise<void> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);
    await redisClient.del(pendingKey);
  }
}
