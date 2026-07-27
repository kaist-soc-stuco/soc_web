import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { secondsUntil } from "@soc/shared";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import type { AuthSessionRecord } from "./auth.types";

const ROTATE_REFRESH_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {0} end
local record = cjson.decode(raw)
if record.revoked then return {1} end
if record.refreshJti ~= ARGV[1] then
  if record.previousRefreshJti == ARGV[1] and record.rotatedAtMs and
     tonumber(ARGV[4]) - tonumber(record.rotatedAtMs) >= 0 and
     tonumber(ARGV[4]) - tonumber(record.rotatedAtMs) <= 5000 then
    return {4}
  end
  record.revoked = true
  redis.call("SET", KEYS[1], cjson.encode(record), "EX", ARGV[3])
  return {2}
end
record.previousRefreshJti = record.refreshJti
record.refreshJti = ARGV[2]
record.rotatedAtMs = tonumber(ARGV[4])
record.familyVersion = (record.familyVersion or 0) + 1
redis.call("SET", KEYS[1], cjson.encode(record), "EX", ARGV[3])
return {3, cjson.encode(record)}
`;

const REVOKE_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ttl = redis.call("TTL", KEYS[1])
if ttl <= 0 then return 0 end
local record = cjson.decode(raw)
record.revoked = true
redis.call("SET", KEYS[1], cjson.encode(record), "EX", ttl)
return 1
`;

@Injectable()
export class AuthSessionRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private buildKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private resolveTtlSeconds(expiresAt: number): number {
    return Math.max(secondsUntil(expiresAt), 1);
  }

  async save(record: AuthSessionRecord): Promise<void> {
    await this.redis.set(
      this.buildKey(record.sessionId),
      JSON.stringify(record),
      "EX",
      this.resolveTtlSeconds(record.expiresAt),
    );
  }

  async findBySessionId(sessionId: string): Promise<AuthSessionRecord | null> {
    const rawValue = await this.redis.get(this.buildKey(sessionId));
    if (!rawValue) return null;
    try {
      return JSON.parse(rawValue) as AuthSessionRecord;
    } catch {
      return null;
    }
  }

  async rotateRefresh(
    sessionId: string,
    currentJti: string,
    nextJti: string,
    expiresAt: number,
  ): Promise<"rotated" | "already_rotated" | "replayed" | "invalid" | "missing"> {
    const result = (await this.redis.eval(
      ROTATE_REFRESH_LUA,
      1,
      this.buildKey(sessionId),
      currentJti,
      nextJti,
      String(this.resolveTtlSeconds(expiresAt)),
      String(Date.now()),
    )) as [number, string?];
    return result[0] === 4 ? "already_rotated" : result[0] === 3 ? "rotated" : result[0] === 2 ? "replayed" : result[0] === 1 ? "invalid" : "missing";
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.eval(REVOKE_LUA, 1, this.buildKey(sessionId));
  }
}