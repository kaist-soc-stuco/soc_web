import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { AdminGovernanceController, PublicPledgesController, PublicVotesController, VoteBallotsController } from './governance.controller';
import { GovernanceRepository } from './governance.repository';
import { GovernanceService } from './governance.service';

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, PermissionsModule],
  controllers: [PublicVotesController, VoteBallotsController, AdminGovernanceController, PublicPledgesController],
  providers: [GovernanceRepository, GovernanceService, AuthGuard, OptionalAuthGuard],
})
export class GovernanceModule {}
