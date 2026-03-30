import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";

import type { AuthSessionRecord } from "./auth.types";

/**
 * Redis 기반 auth session 저장소입니다.
 */
@Injectable()
export class AuthSessionRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** 세션 ID를 Redis key 네임스페이스로 변환합니다. */
  private buildKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  /** 만료 시각 기준으로 Redis TTL(초)을 계산합니다. */
  private resolveTtlSeconds(expiresAt: number): number {
    const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    return Math.max(ttlSeconds, 1);
  }

  /**
    * 세션 메타데이터를 저장합니다.
   */
  async save(record: AuthSessionRecord): Promise<void> {
    const sessionKey = this.buildKey(record.sessionId);

    await this.redis.set(
      sessionKey,
      JSON.stringify(record),
      "EX",
      this.resolveTtlSeconds(record.expiresAt),
    );
  }

  /**
    * 세션 ID로 저장된 세션 메타데이터를 조회합니다.
   */
  async findBySessionId(sessionId: string): Promise<AuthSessionRecord | null> {
    const sessionKey = this.buildKey(sessionId);
    const rawValue = await this.redis.get(sessionKey);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as AuthSessionRecord;
    } catch {
      return null;
    }
  }

  /**
    * 세션을 revoke 상태로 바꿉니다.
   */
  async revoke(sessionId: string): Promise<void> {
    const record = await this.findBySessionId(sessionId);

    if (!record) {
      return;
    }

    await this.save({
      ...record,
      revoked: true,
    });
  }
}
