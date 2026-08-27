import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { BoardController } from "./board.controller";
import { ArticleController } from "./article.controller";
import { ArticleDraftController } from "./article-draft.controller";
import { ArticleSearchController } from "./article-search.controller";
import { CommentController } from "./comment.controller";
import { CommentModerationController } from "./comment-moderation.controller";
import { BoardService } from "./board.service";
import { ArticleService } from "./article.service";
import { ArticleDraftService } from "./article-draft.service";
import { CommentService } from "./comment.service";
import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import { ArticleDraftRepository } from "./repositories/article-draft.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { UsersModule } from "../users/users.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [PostgresModule, UsersModule, AuthModule, NotificationsModule, AuditLogModule],
  controllers: [
    ArticleController,
    ArticleDraftController,
    CommentController,
    CommentModerationController,
    BoardController,
    ArticleSearchController,
  ],
  providers: [
    BoardRepository,
    ArticleRepository,
    ArticleDraftRepository,
    CommentRepository,
    BoardService,
    ArticleService,
    ArticleDraftService,
    CommentService,
  ],
  exports: [ArticleRepository, BoardRepository],
})
export class BoardModule {}
