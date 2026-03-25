import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";
import type { PendingSsoUser } from "./auth.types";

const PENDING_LOGIN_PREFIX = "auth:pending-login:";

@Injectable()
export class PendingLoginRepository {
  private readonly memoryStore = new Map<string, PendingSsoUser>();

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

  async save(pendingLoginToken: string, payload: PendingSsoUser, ttlSeconds: number): Promise<void> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);

    if (redisClient) {
      await redisClient.set(pendingKey, JSON.stringify(payload), "EX", ttlSeconds);
      return;
    }

    this.memoryStore.set(pendingKey, payload);
  }

  async find(pendingLoginToken: string): Promise<PendingSsoUser | null> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);

    if (redisClient) {
      const rawValue = await redisClient.get(pendingKey);
      return rawValue ? this.parse(rawValue) : null;
    }

    const stored = this.memoryStore.get(pendingKey);

    if (!stored) {
      return null;
    }

    if (stored.expiresAt <= Date.now()) {
      this.memoryStore.delete(pendingKey);
      return null;
    }

    return stored;
  }

  async delete(pendingLoginToken: string): Promise<void> {
    const redisClient = await this.getRedisClient();
    const pendingKey = this.buildKey(pendingLoginToken);

    if (redisClient) {
      await redisClient.del(pendingKey);
      return;
    }

    this.memoryStore.delete(pendingKey);
  }
}
