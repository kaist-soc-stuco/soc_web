import { Module } from '@nestjs/common';

import { AuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
