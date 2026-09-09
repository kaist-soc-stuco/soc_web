import { Inject, Module, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT, redisProvider } from "./redis.provider";
import { RequestRateLimitService } from "./request-rate-limit.service";

@Module({
  providers: [redisProvider, RequestRateLimitService],
  exports: [redisProvider, RequestRateLimitService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== "end") {
      this.redis.disconnect(false);
    }
  }
}
