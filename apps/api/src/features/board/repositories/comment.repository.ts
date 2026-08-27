import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentModerationResponse,
  CommentEngagementKind,
  CommentEngagementResponse,
  CommentItem,
  CommentUpdateRequest,
  CommentUpdateResponse,
  HiddenCommentItem,
} from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articles,
  commentEngagements,
  comments,
  users,
} from "../../../infrastructure/postgres/postgres.schema";
import { COMMENT_STATUS } from "../board.constants";
import { msToIso, nowDate } from "@soc/shared";

@Injectable()
export class CommentRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listByArticleId(
    articleId: string,
    page: number,
    limit: number,
    viewerUserId?: string,
  ): Promise<{ items: CommentItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const baseFilter = and(
      eq(comments.articleId, Number(articleId)),
      eq(comments.status, COMMENT_STATUS.PUBLISHED),
    );

    const topLevelFilter = and(baseFilter, isNull(comments.parentCommentId));
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(topLevelFilter);

    const likeCount = sql<number>`(
      select count(*)
      from ${commentEngagements}
      where ${commentEngagements.commentId} = ${comments.commentId}
        and ${commentEngagements.kind} = 'LIKE'
    )`;
    const viewerHasLiked = viewerUserId
      ? sql<boolean>`exists (
          select 1
          from ${commentEngagements}
          where ${commentEngagements.commentId} = ${comments.commentId}
            and ${commentEngagements.userId} = ${viewerUserId}
            and ${commentEngagements.kind} = 'LIKE'
        )`
      : sql<boolean>`false`;
    const selectCommentRows = (filter: typeof baseFilter) => this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        parentCommentId: comments.parentCommentId,
        content: comments.content,
        isOfficial: comments.isOfficial,
        status: comments.status,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        likeCount,
        viewerHasLiked,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorUserId, users.userId))
      .where(filter)
      .orderBy(asc(comments.createdAt));

    const topLevelRows = await selectCommentRows(topLevelFilter)
      .limit(limit)
      .offset(offset);
    const parentIds = topLevelRows.map((row) => row.commentId);
    const replyRows = parentIds.length
      ? await selectCommentRows(
          and(baseFilter, inArray(comments.parentCommentId, parentIds)),
        )
      : [];
    const rows = [...topLevelRows, ...replyRows];

    return {
      total: Number(totalResult[0]?.count ?? 0),
      items: rows.map((row) => ({
        commentId: String(row.commentId),
        articleId: String(row.articleId),
        parentCommentId: row.parentCommentId ? String(row.parentCommentId) : null,
        content: row.content,
        status: row.status as CommentItem["status"],
        createdAt: msToIso(row.createdAt.valueOf()),
        updatedAt: msToIso(row.updatedAt.valueOf()),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.isOfficial
            ? "전산학부 집행위원회"
            : row.authorName ?? "unknown",
        },
        likeCount: Number(row.likeCount ?? 0),
        viewerHasLiked: Boolean(row.viewerHasLiked),
        isOfficial: row.isOfficial,
      })),
    };
  }

  async setCommentEngagement(
    commentId: string,
    userId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ): Promise<CommentEngagementResponse> {
    const normalizedCommentId = Number(commentId);
    const now = nowDate();

    if (active) {
      await this.db
        .insert(commentEngagements)
        .values({
          commentId: normalizedCommentId,
          userId,
          kind,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            commentEngagements.commentId,
            commentEngagements.userId,
            commentEngagements.kind,
          ],
          set: { updatedAt: now },
        });
    } else {
      await this.db
        .delete(commentEngagements)
        .where(
          and(
            eq(commentEngagements.commentId, normalizedCommentId),
            eq(commentEngagements.userId, userId),
            eq(commentEngagements.kind, kind),
          ),
        );
    }

    const summary = await this.getCommentEngagementSummary(commentId, userId);
    return {
      commentId,
      kind,
      active: summary.viewerHasLiked,
      likeCount: summary.likeCount,
      viewerHasLiked: summary.viewerHasLiked,
    };
  }

  async getCommentEngagementSummary(
    commentId: string,
    userId: string,
  ): Promise<Pick<CommentEngagementResponse, "likeCount" | "viewerHasLiked">> {
    const normalizedCommentId = Number(commentId);
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(commentEngagements)
      .where(
        and(
          eq(commentEngagements.commentId, normalizedCommentId),
          eq(commentEngagements.kind, "LIKE"),
        ),
      );
    const [likeResult] = await this.db
      .select({ commentId: commentEngagements.commentId })
      .from(commentEngagements)
      .where(
        and(
          eq(commentEngagements.commentId, normalizedCommentId),
          eq(commentEngagements.userId, userId),
          eq(commentEngagements.kind, "LIKE"),
        ),
      )
      .limit(1);
    return {
      likeCount: Number(countResult?.count ?? 0),
      viewerHasLiked: Boolean(likeResult),
    };
  }

  async findPermissionInfo(
    commentId: string,
    articleId: string,
    boardId: number,
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
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .where(
        and(
          eq(comments.commentId, Number(commentId)),
          eq(comments.articleId, Number(articleId)),
          eq(articles.boardId, boardId),
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
    parentCommentId: string | null;
    status: string;
  } | null> {
    const row = await this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        parentCommentId: comments.parentCommentId,
        status: comments.status,
      })
      .from(comments)
      .where(eq(comments.commentId, Number(commentId)))
      .limit(1);

    if (!row[0]) return null;

    return {
      commentId: String(row[0].commentId),
      articleId: String(row[0].articleId),
      parentCommentId: row[0].parentCommentId
        ? String(row[0].parentCommentId)
        : null,
      status: row[0].status,
    };
  }

  async createComment(input: {
    articleId: string;
    authorUserId: string;
    payload: CommentCreateRequest;
    isOfficial: boolean;
  }): Promise<CommentCreateResponse> {
    const now = nowDate();
    const [created] = await this.db
      .insert(comments)
      .values({
        articleId: Number(input.articleId),
        authorUserId: input.authorUserId,
        parentCommentId: input.payload.parentCommentId ? Number(input.payload.parentCommentId) : null,
        content: input.payload.content,
        isOfficial: input.isOfficial,
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
      createdAt: msToIso(created.createdAt.valueOf()),
    };
  }

  async findNotificationTargets(commentId: string): Promise<{
    articleId: string;
    articleAuthorUserId: string;
    articleTitleKo: string;
    boardCode: string;
    parentCommentAuthorUserId: string | null;
    isReply: boolean;
    isOfficial: boolean;
  } | null> {
    const [comment] = await this.db
      .select({
        articleId: comments.articleId,
        parentCommentId: comments.parentCommentId,
        isOfficial: comments.isOfficial,
      })
      .from(comments)
      .where(eq(comments.commentId, Number(commentId)))
      .limit(1);

    if (!comment) return null;

    const [article] = await this.db
      .select({
        articleAuthorUserId: articles.authorUserId,
        articleId: articles.articleId,
        articleTitleKo: articles.titleKo,
        boardCode: sql<string>`(
          select code from board where board_id = ${articles.boardId} limit 1
        )`,
      })
      .from(articles)
      .where(eq(articles.articleId, comment.articleId))
      .limit(1);

    if (!article) return null;

    let parentCommentAuthorUserId: string | null = null;
    if (comment.parentCommentId) {
      const [parent] = await this.db
        .select({ authorUserId: comments.authorUserId })
        .from(comments)
        .where(eq(comments.commentId, comment.parentCommentId))
        .limit(1);
      parentCommentAuthorUserId = parent?.authorUserId ?? null;
    }

    return {
      articleId: String(article.articleId),
      articleAuthorUserId: String(article.articleAuthorUserId),
      articleTitleKo: article.articleTitleKo,
      boardCode: article.boardCode,
      parentCommentAuthorUserId,
      isReply: Boolean(comment.parentCommentId),
      isOfficial: comment.isOfficial,
    };
  }

  async updateComment(
    commentId: string,
    payload: CommentUpdateRequest,
  ): Promise<CommentUpdateResponse> {
    const now = nowDate();
    await this.db
      .update(comments)
      .set({
        content: payload.content,
        updatedAt: now,
      })
      .where(eq(comments.commentId, Number(commentId)));

    return {
      commentId,
      updatedAt: msToIso(now.valueOf()),
    };
  }

  async softDeleteComment(commentId: string): Promise<CommentDeleteResponse> {
    const now = nowDate();
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
      deletedAt: msToIso(now.valueOf()),
    };
  }

  async moderateComment(
    commentId: string,
    input: { hidden: boolean; moderatorUserId: string; reason?: string },
  ): Promise<CommentModerationResponse> {
    const now = nowDate();
    await this.db
      .update(comments)
      .set({
        status: input.hidden ? COMMENT_STATUS.HIDDEN : COMMENT_STATUS.PUBLISHED,
        hiddenAt: input.hidden ? now : null,
        hiddenByUserId: input.hidden ? input.moderatorUserId : null,
        hiddenReason: input.hidden ? input.reason?.trim() ?? null : null,
        updatedAt: now,
      })
      .where(eq(comments.commentId, Number(commentId)));

    return {
      commentId,
      status: input.hidden ? "HIDDEN" : "PUBLISHED",
      hiddenAt: input.hidden ? msToIso(now.valueOf()) : null,
    };
  }

  async listHiddenComments(): Promise<HiddenCommentItem[]> {
    const rows = await this.db
      .select({
        commentId: comments.commentId,
        articleId: comments.articleId,
        articleTitleKo: articles.titleKo,
        boardCode: sql<string>`(select code from board where board_id = ${articles.boardId} limit 1)`,
        content: comments.content,
        authorName: users.nameKo,
        hiddenAt: comments.hiddenAt,
        hiddenReason: comments.hiddenReason,
      })
      .from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .leftJoin(users, eq(comments.authorUserId, users.userId))
      .where(eq(comments.status, COMMENT_STATUS.HIDDEN))
      .orderBy(sql`${comments.hiddenAt} desc`);

    return rows.flatMap((row) =>
      row.hiddenAt
        ? [{
            commentId: String(row.commentId),
            articleId: String(row.articleId),
            articleTitleKo: row.articleTitleKo,
            boardCode: row.boardCode,
            content: row.content,
            authorName: row.authorName ?? "알 수 없음",
            hiddenAt: msToIso(row.hiddenAt.valueOf()),
            hiddenReason: row.hiddenReason ?? "",
          }]
        : [],
    );
  }
}
