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

const RESERVE_PENDING_LOGIN_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {0} end
local ttl = redis.call("TTL", KEYS[1])
if ttl <= 0 then return {0} end
local record = cjson.decode(raw)
if record.state == "processing" and record.leaseExpiresAtMs and
   tonumber(record.leaseExpiresAtMs) > tonumber(ARGV[1]) then
  return {0}
end
record.state = "processing"
record.reservationToken = ARGV[3]
record.leaseExpiresAtMs = tonumber(ARGV[1]) + tonumber(ARGV[2])
local reserved = cjson.encode(record)
redis.call("SET", KEYS[1], reserved, "EX", ttl)
return {1, reserved}
`;

const RELEASE_PENDING_LOGIN_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ttl = redis.call("TTL", KEYS[1])
if ttl <= 0 then return 0 end
local record = cjson.decode(raw)
if record.state ~= "processing" or record.reservationToken ~= ARGV[1] then return 0 end
record.state = "pending"
record.reservationToken = nil
record.leaseExpiresAtMs = nil
redis.call("SET", KEYS[1], cjson.encode(record), "EX", ttl)
return 1
`;

const COMPLETE_PENDING_LOGIN_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if record.state ~= "processing" or record.reservationToken ~= ARGV[1] then return 0 end
return redis.call("DEL", KEYS[1])
`;

interface StoredPendingSsoUser {
  encryptedSsoUserId?: string;
  encryptedUserEmail?: string;
  encryptedUserMobile?: string;
  expiresAt: number;
  state?: "pending" | "processing";
  reservedAtMs?: number;
  reservationToken?: string;
  leaseExpiresAtMs?: number;
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
    try {
      const [ivRaw, authTagRaw, encryptedRaw, ...extra] = cipherText.split(".");
      const decode = (value: string | undefined): Buffer => {
        if (
          !value ||
          !/^[A-Za-z0-9_-]+$/.test(value) ||
          value.length % 4 === 1
        ) {
          throw new InternalServerErrorException("pending_login_payload_corrupted");
        }
        const decoded = Buffer.from(value, "base64url");
        if (decoded.toString("base64url") !== value) {
          throw new InternalServerErrorException("pending_login_payload_corrupted");
        }
        return decoded;
      };
      if (extra.length) {
        throw new InternalServerErrorException("pending_login_payload_corrupted");
      }
      const iv = decode(ivRaw);
      const authTag = decode(authTagRaw);
      const encrypted = decode(encryptedRaw);
      if (iv.length !== 12 || authTag.length !== 16) {
        throw new InternalServerErrorException("pending_login_payload_corrupted");
      }
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException("pending_login_payload_corrupted");
    }
  }

  private serialize(payload: PendingSsoUser): StoredPendingSsoUser {
    return {
      encryptedSsoUserId: this.encrypt(payload.ssoUserId),
      encryptedUserEmail: payload.userEmail
        ? this.encrypt(payload.userEmail)
        : undefined,
      encryptedUserMobile: payload.userMobile
        ? this.encrypt(payload.userMobile)
        : undefined,
      expiresAt: payload.expiresAt,
      state: "pending",
      reservedAtMs: undefined,
    };
  }

  private parse(rawValue: string): PendingSsoUser | null {
    let parsed: StoredPendingSsoUser;
    try {
      parsed = JSON.parse(rawValue) as StoredPendingSsoUser;
    } catch {
      return null;
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() ||
      (parsed.state !== undefined &&
        parsed.state !== "pending" &&
        parsed.state !== "processing") ||
      (parsed.reservedAtMs !== undefined &&
        (typeof parsed.reservedAtMs !== "number" ||
          !Number.isFinite(parsed.reservedAtMs))) ||
      (parsed.reservationToken !== undefined && typeof parsed.reservationToken !== "string") ||
      (parsed.leaseExpiresAtMs !== undefined &&
        (typeof parsed.leaseExpiresAtMs !== "number" || !Number.isFinite(parsed.leaseExpiresAtMs))) ||
      typeof parsed.encryptedSsoUserId !== "string" ||
      !parsed.encryptedSsoUserId ||
      (parsed.encryptedUserEmail !== undefined &&
        typeof parsed.encryptedUserEmail !== "string") ||
      (parsed.encryptedUserMobile !== undefined &&
        typeof parsed.encryptedUserMobile !== "string")
    ) {
      return null;
    }
    return {
      expiresAt: parsed.expiresAt,
      ssoUserId: this.decrypt(parsed.encryptedSsoUserId),
      userEmail: parsed.encryptedUserEmail
        ? this.decrypt(parsed.encryptedUserEmail)
        : undefined,
      userMobile: parsed.encryptedUserMobile
        ? this.decrypt(parsed.encryptedUserMobile)
        : undefined,
    };
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


  async reserve(pendingLoginToken: string): Promise<{ pending: PendingSsoUser; reservationToken: string } | null> {
    const reservationToken = randomBytes(32).toString("base64url");
    const result = (await this.redis.eval(
      RESERVE_PENDING_LOGIN_LUA, 1, this.buildKey(pendingLoginToken),
      String(Date.now()), "30000", reservationToken,
    )) as [number, string?];
    if (result[0] !== 1 || !result[1]) return null;
    const pending = this.parse(result[1]);
    return pending ? { pending, reservationToken } : null;
  }

  async release(pendingLoginToken: string, reservationToken: string): Promise<void> {
    await this.redis.eval(RELEASE_PENDING_LOGIN_LUA, 1, this.buildKey(pendingLoginToken), reservationToken);
  }

  async complete(pendingLoginToken: string, reservationToken: string): Promise<void> {
    await this.redis.eval(COMPLETE_PENDING_LOGIN_LUA, 1, this.buildKey(pendingLoginToken), reservationToken);
  }

}
