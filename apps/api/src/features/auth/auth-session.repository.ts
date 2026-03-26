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

  private buildKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private resolveTtlSeconds(expiresAt: number): number {
    const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    return Math.max(ttlSeconds, 1);
  }

  /**
   * 세션 메타데이터를 저장합니다.
   *
   * @param record 저장할 세션 레코드
   * @returns Promise<void>
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
   *
   * @param sessionId 세션 식별자
   * @returns 세션 레코드 또는 null
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
   *
   * @param sessionId 세션 식별자
   * @returns Promise<void>
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
