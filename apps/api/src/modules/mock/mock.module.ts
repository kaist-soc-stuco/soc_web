import { Module } from '@nestjs/common';

import { RedisModule } from '../../cache/redis/redis.module';
import { PostgresModule } from '../../database/postgres/postgres.module';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [MockController],
  providers: [MockService],
})
export class MockModule {}
