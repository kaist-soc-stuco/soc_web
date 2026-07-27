import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { ClockModule } from '../../shared/time/clock.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import {
  AdminBoardsController,
  BoardWritesController,
  PublicArticlesController,
  PublicBoardsController,
} from './boards.controller';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';
import { BoardsRepository } from './boards.repository';
import { BoardsService } from './boards.service';
import { InteractionsRepository } from './interactions.repository';
import { InteractionsService } from './interactions.service';
import { PurgeRepository } from './purge.repository';
import { PurgeService } from './purge.service';

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, PermissionsModule, ClockModule],
  controllers: [PublicBoardsController, PublicArticlesController, AdminBoardsController, BoardWritesController],
  providers: [
    BoardsRepository,
    BoardsService,
    ArticlesRepository,
    ArticlesService,
    InteractionsRepository,
    InteractionsService,
    PurgeRepository,
    PurgeService,
    AuthGuard,
    OptionalAuthGuard,
  ],
  exports: [PurgeService],
})
export class BoardsModule {}
