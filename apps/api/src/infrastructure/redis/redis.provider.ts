import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    const redis = new Redis(configService.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
    });

    // Keep connection failures from surfacing as unhandled error events.
    redis.on('error', () => undefined);

    return redis;
  },
};
