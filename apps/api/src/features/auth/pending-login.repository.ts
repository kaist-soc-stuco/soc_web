import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import type { PendingSsoUser } from "./auth.types";

const PENDING_LOGIN_PREFIX = "auth:pending-login:";

@Injectable()
export class PendingLoginRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private buildKey(pendingLoginToken: string): string {
    return `${PENDING_LOGIN_PREFIX}${pendingLoginToken}`;
  }

  private parse(rawValue: string): PendingSsoUser | null {
    try {
      return JSON.parse(rawValue) as PendingSsoUser;
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
    await redisClient.set(pendingKey, JSON.stringify(payload), "EX", ttlSeconds);
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
