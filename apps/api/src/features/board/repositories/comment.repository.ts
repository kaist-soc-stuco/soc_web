import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  CommentCreateRequest,
  CommentCreateResponse,
  CommentItem,
  CommentUpdateRequest,
  CommentUpdateResponse,
  CommentDeleteResponse,
} from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  comments,
  users,
} from "../../../infrastructure/postgres/postgres.schema";
import { COMMENT_STATUS } from "../board.constants";

@Injectable()
export class CommentRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listByArticleId(
    articleId: string,
    page: number,
    limit: number,
  ): Promise<{ items: CommentItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const baseFilter = and(
      eq(comments.articleId, Number(articleId)),
      eq(comments.status, COMMENT_STATUS.PUBLISHED),
    );

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(baseFilter);

    const rows = await this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        parentCommentId: comments.parentCommentId,
        content: comments.content,
        status: comments.status,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorUserId, users.id))
      .where(baseFilter)
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      total: Number(totalResult[0]?.count ?? 0),
      items: rows.map((row) => ({
        commentId: String(row.commentId),
        articleId: String(row.articleId),
        parentCommentId: row.parentCommentId ? String(row.parentCommentId) : null,
        content: row.content,
        status: row.status as CommentItem["status"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.authorName ?? "unknown",
        },
      })),
    };
  }

  async findPermissionInfo(
    commentId: string,
    articleId: string,
  ): Promise<{
    authorUserId: string;
    status: string;
  } | null> {
    const row = await this.db
      .select({
        authorUserId: comments.authorUserId,
        status: comments.status,
      })
      .from(comments)
      .where(
        and(
          eq(comments.commentId, Number(commentId)),
          eq(comments.articleId, Number(articleId)),
        ),
      )
      .limit(1);

    if (!row[0]) return null;

    return {
      authorUserId: String(row[0].authorUserId),
      status: row[0].status,
    };
  }

  async findById(commentId: string): Promise<{
    commentId: string;
    articleId: string;
    status: string;
  } | null> {
    const row = await this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        status: comments.status,
      })
      .from(comments)
      .where(eq(comments.commentId, Number(commentId)))
      .limit(1);

    if (!row[0]) return null;

    return {
      commentId: String(row[0].commentId),
      articleId: String(row[0].articleId),
      status: row[0].status,
    };
  }

  async createComment(input: {
    articleId: string;
    authorUserId: string;
    payload: CommentCreateRequest;
  }): Promise<CommentCreateResponse> {
    const now = new Date();
    const [created] = await this.db
      .insert(comments)
      .values({
        articleId: Number(input.articleId),
        authorUserId: Number(input.authorUserId),
        parentCommentId: input.payload.parentCommentId ? Number(input.payload.parentCommentId) : null,
        content: input.payload.content,
        status: COMMENT_STATUS.PUBLISHED,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        commentId: comments.commentId,
        createdAt: comments.createdAt,
      });

    return {
      commentId: String(created.commentId),
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateComment(
    commentId: string,
    payload: CommentUpdateRequest,
  ): Promise<CommentUpdateResponse> {
    const now = new Date();
    await this.db
      .update(comments)
      .set({
        content: payload.content,
        updatedAt: now,
      })
      .where(eq(comments.commentId, Number(commentId)));

    return {
      commentId,
      updatedAt: now.toISOString(),
    };
  }

  async softDeleteComment(commentId: string): Promise<CommentDeleteResponse> {
    const now = new Date();
    await this.db
      .update(comments)
      .set({
        status: COMMENT_STATUS.DELETED,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(comments.commentId, Number(commentId)));

    return {
      ok: true,
      commentId: String(commentId),
      deletedAt: now.toISOString(),
    };
  }
}
