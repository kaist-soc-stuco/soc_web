import { Module } from '@nestjs/common';

import { AuthSessionRepository } from '../auth/auth-session.repository';
import { AuthGuard, PermissionGuard } from '../../shared/guards';
import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [UsersController],
  providers: [
    UsersRepository,
    UsersService,
    AuthSessionRepository,
    AuthGuard,
    PermissionGuard,
  ],
  exports: [UsersService],
})
export class UsersModule {}
