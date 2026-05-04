import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { BoardController } from "./board.controller";
import { ArticleController } from "./article.controller";
import { CommentController } from "./comment.controller";
import { BoardService } from "./board.service";
import { ArticleService } from "./article.service";
import { CommentService } from "./comment.service";
import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [PostgresModule, UsersModule, AuthModule],
  controllers: [BoardController, ArticleController, CommentController],
  providers: [
    BoardRepository,
    ArticleRepository,
    CommentRepository,
    BoardService,
    ArticleService,
    CommentService,
  ],
})
export class BoardModule {}
