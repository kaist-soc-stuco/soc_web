import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [MockController],
  providers: [MockService],
})
export class MockModule {}
