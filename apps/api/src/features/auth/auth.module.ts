import { forwardRef, Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { PendingLoginRepository } from './pending-login.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { AuthStateRepository } from './auth-state.repository';

@Module({
  imports: [RedisModule, forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionRepository,
    AuthSessionService,
    PendingLoginRepository,
    AuthStateRepository,
  ],
  exports: [AuthSessionService],
})
export class AuthModule {}
