import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import type { PendingSsoUser } from "./auth.types";

const PENDING_LOGIN_PREFIX = "auth:pending-login:";

interface StoredPendingSsoUser {
  encryptedUserEmail?: string;
  encryptedUserMobile?: string;
  expiresAt: number;
  name?: string;
  ssoUserId: string;
}

@Injectable()
export class PendingLoginRepository {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.encryptionKey = this.createEncryptionKey();
  }

  private buildKey(pendingLoginToken: string): string {
    return `${PENDING_LOGIN_PREFIX}${pendingLoginToken}`;
  }

  private createEncryptionKey(): Buffer {
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
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
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

    const iv = Buffer.from(ivRaw, "base64url");
    const authTag = Buffer.from(authTagRaw, "base64url");
    const encrypted = Buffer.from(encryptedRaw, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);

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
      name: payload.name,
      ssoUserId: payload.ssoUserId,
    };
  }

  private parse(rawValue: string): PendingSsoUser | null {
    try {
      const parsed = JSON.parse(rawValue) as StoredPendingSsoUser;

      return {
        expiresAt: parsed.expiresAt,
        name: parsed.name,
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

  async save(pendingLoginToken: string, payload: PendingSsoUser, ttlSeconds: number): Promise<void> {
    const pendingKey = this.buildKey(pendingLoginToken);

    await this.redis.set(
      pendingKey,
      JSON.stringify(this.serialize(payload)),
      "EX",
      ttlSeconds,
    );
  }

  async find(pendingLoginToken: string): Promise<PendingSsoUser | null> {
    const pendingKey = this.buildKey(pendingLoginToken);
    const rawValue = await this.redis.get(pendingKey);
    return rawValue ? this.parse(rawValue) : null;
  }

  async delete(pendingLoginToken: string): Promise<void> {
    const pendingKey = this.buildKey(pendingLoginToken);
    await this.redis.del(pendingKey);
  }
}
