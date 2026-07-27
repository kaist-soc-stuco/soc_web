import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { PiiCipherService } from '../../shared/security/pii-cipher.service';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { AdminSurveysController, PublicSurveysController } from './surveys.controller';
import { SurveysRepository } from './surveys.repository';
import { SurveysService } from './surveys.service';

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, PermissionsModule],
  controllers: [PublicSurveysController, AdminSurveysController],
  providers: [SurveysRepository, SurveysService, PiiCipherService, AuthGuard, OptionalAuthGuard],
  exports: [SurveysService],
})
export class SurveysModule {}
