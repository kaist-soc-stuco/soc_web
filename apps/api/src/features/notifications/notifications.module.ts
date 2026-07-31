import { Module } from '@nestjs/common';

import { AuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { ContactsModule } from '../contacts/contacts.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, ContactsModule, PermissionsModule, UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
