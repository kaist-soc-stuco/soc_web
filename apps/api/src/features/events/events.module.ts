import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { AdminEventsController, PublicEventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, PermissionsModule],
  controllers: [PublicEventsController, AdminEventsController],
  providers: [EventsRepository, EventsService, AuthGuard, OptionalAuthGuard],
})
export class EventsModule {}
