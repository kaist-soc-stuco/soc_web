import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';

@Module({
  imports: [RedisModule],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionRepository, AuthSessionService],
})
export class AuthModule {}
