import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
