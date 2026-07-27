import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { AdminFaqsController, PublicFaqsController } from './faqs.controller';
import { FaqsRepository } from './faqs.repository';
import { FaqsService } from './faqs.service';

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, PermissionsModule],
  controllers: [PublicFaqsController, AdminFaqsController],
  providers: [FaqsRepository, FaqsService, AuthGuard],
})
export class FaqsModule {}
