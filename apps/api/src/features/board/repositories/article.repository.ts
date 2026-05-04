import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDetailResponse,
  ArticleListItem,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  ArticleDeleteResponse,
} from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleAssets,
  articles,
  assets,
  comments,
  users,
} from "../../../infrastructure/postgres/postgres.schema";
import { ARTICLE_STATUS, COMMENT_STATUS } from "../board.constants";

@Injectable()
export class ArticleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listByBoardId(
    boardId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ArticleListItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const baseFilter = and(
      eq(articles.boardId, boardId),
      eq(articles.status, ARTICLE_STATUS.PUBLISHED),
    );

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(baseFilter);

    const rows = await this.db
      .select({
        articleId: articles.articleId,
        boardId: articles.boardId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        status: articles.status,
        visibilityScope: articles.visibilityScope,
        isPinned: articles.isPinned,
        pinOrder: articles.pinOrder,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.id,
        authorName: users.name,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.id))
      .where(baseFilter)
      .orderBy(
        desc(articles.isPinned),
        asc(sql`coalesce(${articles.pinOrder}, 2147483647)`),
        desc(articles.postedAt),
      )
      .limit(limit)
      .offset(offset);

    return {
      total: Number(totalResult[0]?.count ?? 0),
      items: rows.map((row) => ({
        articleId: row.articleId,
        boardId: row.boardId,
        titleKo: row.titleKo,
        titleEn: row.titleEn ?? undefined,
        status: row.status as ArticleListItem["status"],
        visibilityScope: row.visibilityScope as ArticleListItem["visibilityScope"],
        isPinned: row.isPinned,
        pinOrder: row.pinOrder ?? null,
        postedAt: row.postedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        author: {
          userId: row.authorId ?? "",
          name: row.authorName ?? "unknown",
        },
        commentCount: Number(row.commentCount ?? 0),
      })),
    };
  }

  async findDetailById(
    boardId: string,
    articleId: string,
  ): Promise<ArticleDetailResponse | null> {
    const row = await this.db
      .select({
        articleId: articles.articleId,
        boardId: articles.boardId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        contentKo: articles.contentKo,
        contentEn: articles.contentEn,
        status: articles.status,
        visibilityScope: articles.visibilityScope,
        isPinned: articles.isPinned,
        pinOrder: articles.pinOrder,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.id,
        authorName: users.name,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.id))
      .where(and(
        eq(articles.boardId, boardId),
        eq(articles.articleId, articleId),
        eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      ))
      .limit(1);

    if (!row[0]) {
      return null;
    }

    const assetRows = await this.db
      .select({
        assetId: assets.assetId,
        usageType: articleAssets.usageType,
        sortOrder: articleAssets.sortOrder,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
        sizeBytes: assets.sizeBytes,
        storageKey: assets.storageKey,
      })
      .from(articleAssets)
      .innerJoin(assets, eq(articleAssets.assetId, assets.assetId))
      .where(eq(articleAssets.articleId, articleId))
      .orderBy(asc(articleAssets.sortOrder));

    return {
      articleId: row[0].articleId,
      boardId: row[0].boardId,
      titleKo: row[0].titleKo,
      titleEn: row[0].titleEn ?? undefined,
      contentKo: row[0].contentKo,
      contentEn: row[0].contentEn ?? undefined,
      status: row[0].status as ArticleDetailResponse["status"],
      visibilityScope: row[0].visibilityScope as ArticleDetailResponse["visibilityScope"],
      isPinned: row[0].isPinned,
      pinOrder: row[0].pinOrder ?? null,
      postedAt: row[0].postedAt.toISOString(),
      updatedAt: row[0].updatedAt.toISOString(),
      author: {
        userId: row[0].authorId ?? "",
        name: row[0].authorName ?? "unknown",
      },
      assets: assetRows.map((assetRow) => ({
        assetId: assetRow.assetId,
        usageType: assetRow.usageType as ArticleDetailResponse["assets"][number]["usageType"],
        sortOrder: assetRow.sortOrder,
        originalFilename: assetRow.originalFilename,
        mimeType: assetRow.mimeType,
        sizeBytes: assetRow.sizeBytes,
        storageKey: assetRow.storageKey,
      })),
      commentCount: Number(row[0].commentCount ?? 0),
    };
  }

  async createArticle(input: {
    boardId: string;
    authorUserId: string;
    payload: ArticleCreateRequest;
  }): Promise<ArticleCreateResponse> {
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(articles)
        .values({
          boardId: input.boardId,
          authorUserId: input.authorUserId,
          titleKo: input.payload.titleKo,
          titleEn: input.payload.titleEn ?? null,
          contentKo: input.payload.contentKo,
          contentEn: input.payload.contentEn ?? null,
          status: ARTICLE_STATUS.PUBLISHED,
          visibilityScope: input.payload.visibilityScope,
          isPinned: input.payload.isPinned ?? false,
          pinOrder: input.payload.pinOrder ?? null,
          postedAt: now,
          updatedAt: now,
        })
        .returning({
          articleId: articles.articleId,
          boardId: articles.boardId,
          postedAt: articles.postedAt,
        });

      if (input.payload.assets && input.payload.assets.length > 0) {
        await tx.insert(articleAssets).values(
          input.payload.assets.map((asset) => ({
            articleId: created.articleId,
            assetId: asset.assetId,
            usageType: asset.usageType,
            sortOrder: asset.sortOrder,
          })),
        );
      }

      return {
        articleId: created.articleId,
        boardId: created.boardId,
        postedAt: created.postedAt.toISOString(),
      };
    });
  }

  async findPermissionInfo(
    boardId: string,
    articleId: string,
  ): Promise<{
    authorUserId: string;
    status: string;
  } | null> {
    const row = await this.db
      .select({
        authorUserId: articles.authorUserId,
        status: articles.status,
      })
      .from(articles)
      .where(and(
        eq(articles.boardId, boardId),
        eq(articles.articleId, articleId),
      ))
      .limit(1);

    return row[0] ?? null;
  }

  async updateArticle(
    boardId: string,
    articleId: string,
    payload: ArticleUpdateRequest,
  ): Promise<ArticleUpdateResponse> {
    const now = new Date();
    const updateSet: {
      titleKo?: string;
      titleEn?: string | null;
      contentKo?: string;
      contentEn?: string | null;
      visibilityScope?: string;
      isPinned?: boolean;
      pinOrder?: number | null;
      updatedAt: Date;
    } = {
      updatedAt: now,
    };

    if (payload.titleKo !== undefined) {
      updateSet.titleKo = payload.titleKo;
    }

    if (payload.titleEn !== undefined) {
      updateSet.titleEn = payload.titleEn ?? null;
    }

    if (payload.contentKo !== undefined) {
      updateSet.contentKo = payload.contentKo;
    }

    if (payload.contentEn !== undefined) {
      updateSet.contentEn = payload.contentEn ?? null;
    }

    if (payload.visibilityScope !== undefined) {
      updateSet.visibilityScope = payload.visibilityScope;
    }

    if (payload.isPinned !== undefined) {
      updateSet.isPinned = payload.isPinned;
    }

    if (payload.pinOrder !== undefined) {
      updateSet.pinOrder = payload.pinOrder ?? null;
    }

    return this.db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set(updateSet)
        .where(and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, articleId),
        ));

      if (payload.assets) {
        await tx
          .delete(articleAssets)
          .where(eq(articleAssets.articleId, articleId));

        if (payload.assets.length > 0) {
          await tx.insert(articleAssets).values(
            payload.assets.map((asset) => ({
              articleId,
              assetId: asset.assetId,
              usageType: asset.usageType,
              sortOrder: asset.sortOrder,
            })),
          );
        }
      }

      return {
        articleId,
        updatedAt: now.toISOString(),
      };
    });
  }

  async softDeleteArticle(
    boardId: string,
    articleId: string,
  ): Promise<ArticleDeleteResponse> {
    const now = new Date();

    await this.db
      .update(articles)
      .set({
        status: ARTICLE_STATUS.DELETED,
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(articles.boardId, boardId),
        eq(articles.articleId, articleId),
      ));

    return {
      ok: true,
      articleId,
      deletedAt: now.toISOString(),
    };
  }

  async isReadableArticle(boardId: string, articleId: string): Promise<boolean> {
    const row = await this.db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(
        eq(articles.boardId, boardId),
        eq(articles.articleId, articleId),
        eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      ))
      .limit(1);

    return Boolean(row[0]);
  }
}
