import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
import { comments, users } from "../../../infrastructure/postgres/postgres.schema";

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
      eq(comments.articleId, articleId),
      eq(comments.status, "PUBLISHED"),
      isNull(comments.deletedAt),
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
        commentId: row.commentId,
        articleId: row.articleId,
        parentCommentId: row.parentCommentId ?? null,
        content: row.content,
        status: row.status as CommentItem["status"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        author: {
          userId: row.authorId ?? "",
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
    deletedAt: Date | null;
  } | null> {
    const row = await this.db
      .select({
        authorUserId: comments.authorUserId,
        status: comments.status,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .where(and(
        eq(comments.commentId, commentId),
        eq(comments.articleId, articleId),
      ))
      .limit(1);

    return row[0] ?? null;
  }

  async findById(commentId: string): Promise<{
    commentId: string;
    articleId: string;
    status: string;
    deletedAt: Date | null;
  } | null> {
    const row = await this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        status: comments.status,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .where(eq(comments.commentId, commentId))
      .limit(1);

    return row[0] ?? null;
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
        articleId: input.articleId,
        authorUserId: input.authorUserId,
        parentCommentId: input.payload.parentCommentId ?? null,
        content: input.payload.content,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        commentId: comments.commentId,
        createdAt: comments.createdAt,
      });

    return {
      commentId: created.commentId,
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
      .where(eq(comments.commentId, commentId));

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
        status: "DELETED",
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(comments.commentId, commentId));

    return {
      ok: true,
      commentId,
      deletedAt: now.toISOString(),
    };
  }
}
