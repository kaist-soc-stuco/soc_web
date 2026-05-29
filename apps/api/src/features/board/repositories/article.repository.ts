import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  lt,
  gt,
} from "drizzle-orm";
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
  surveys,
  boards,
} from "../../../infrastructure/postgres/postgres.schema";
import { ARTICLE_STATUS, COMMENT_STATUS } from "../board.constants";
import { msToIso, nowDate } from "@soc/shared";

@Injectable()
export class ArticleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listByBoardId(
    boardId: number,
    page: number,
    limit: number,
    query?: string,
  ): Promise<{ items: ArticleListItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;

    const baseFilter = and(
      eq(articles.boardId, boardId),
      eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      searchFilter,
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
        isAnonymous: articles.isAnonymous,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
        hasAttachment: sql<boolean>`exists (
          select 1
          from ${articleAssets}
          where ${articleAssets.articleId} = ${articles.articleId}
            and ${articleAssets.usageType} = 'ATTACHMENT'
        )`,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescription: articles.eventDescription,
        surveyId: surveys.surveyId,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(surveys, eq(surveys.connectedArticleId, articles.articleId))
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
        articleId: String(row.articleId),
        boardId: row.boardId,
        titleKo: row.titleKo,
        titleEn: row.titleEn ?? undefined,
        status: row.status as ArticleListItem["status"],
        visibilityScope:
          row.visibilityScope as ArticleListItem["visibilityScope"],
        isPinned: row.isPinned,
        pinOrder: row.pinOrder ?? null,
        isAnonymous: row.isAnonymous,
        postedAt: msToIso(row.postedAt.valueOf()),
        updatedAt: msToIso(row.updatedAt.valueOf()),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.authorName ?? "unknown",
        },
        commentCount: Number(row.commentCount ?? 0),
        viewCount: row.viewCount,
        hasAttachment: Boolean(row.hasAttachment),
        eventStartDate: row.eventStartDate ? msToIso(row.eventStartDate.valueOf()) : undefined,
        eventEndDate: row.eventEndDate ? msToIso(row.eventEndDate.valueOf()) : undefined,
        eventDescription: row.eventDescription ?? undefined,
        surveyId: row.surveyId ?? undefined,
      })),
    };
  }

  async listByBoardIds(
    boardIds: number[],
    params: {
      cutoffDate?: Date;
      limit: number;
      page: number;
      query?: string;
      searchBy: "title" | "author" | "title_content";
      sortBy: "latest" | "views";
    },
  ): Promise<{ items: ArticleListItem[]; total: number }> {
    if (boardIds.length === 0) {
      return { items: [], total: 0 };
    }

    const offset = (params.page - 1) * params.limit;
    const normalizedQuery = params.query?.trim();
    const searchFilter = normalizedQuery
      ? params.searchBy === "author"
        ? or(
            ilike(users.nameKo, `%${normalizedQuery}%`),
            ilike(users.nameEn, `%${normalizedQuery}%`),
          )
        : or(
            ilike(articles.titleKo, `%${normalizedQuery}%`),
            ilike(articles.titleEn, `%${normalizedQuery}%`),
          )
      : undefined;
    const cutoffFilter = params.cutoffDate
      ? gte(articles.postedAt, params.cutoffDate)
      : undefined;

    const baseFilter = and(
      inArray(articles.boardId, boardIds),
      eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      searchFilter,
      cutoffFilter,
    );

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(baseFilter);

    const rows = await this.db
      .select({
        articleId: articles.articleId,
        boardId: articles.boardId,
        boardCode: boards.code,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        status: articles.status,
        visibilityScope: articles.visibilityScope,
        isPinned: articles.isPinned,
        pinOrder: articles.pinOrder,
        isAnonymous: articles.isAnonymous,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
        hasAttachment: sql<boolean>`exists (
          select 1
          from ${articleAssets}
          where ${articleAssets.articleId} = ${articles.articleId}
            and ${articleAssets.usageType} = 'ATTACHMENT'
        )`,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescription: articles.eventDescription,
        surveyId: surveys.surveyId,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(boards, eq(articles.boardId, boards.boardId))
      .leftJoin(surveys, eq(surveys.connectedArticleId, articles.articleId))
      .where(baseFilter)
      .orderBy(
        params.sortBy === "views"
          ? desc(articles.viewCount)
          : desc(articles.postedAt),
        desc(articles.postedAt),
      )
      .limit(params.limit)
      .offset(offset);

    return {
      total: Number(totalResult[0]?.count ?? 0),
      items: rows.map((row) => ({
        articleId: String(row.articleId),
        boardId: row.boardId,
        boardCode: row.boardCode ?? undefined,
        titleKo: row.titleKo,
        titleEn: row.titleEn ?? undefined,
        status: row.status as ArticleListItem["status"],
        visibilityScope:
          row.visibilityScope as ArticleListItem["visibilityScope"],
        isPinned: row.isPinned,
        pinOrder: row.pinOrder ?? null,
        isAnonymous: row.isAnonymous,
        postedAt: msToIso(row.postedAt.valueOf()),
        updatedAt: msToIso(row.updatedAt.valueOf()),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.authorName ?? "unknown",
        },
        commentCount: Number(row.commentCount ?? 0),
        viewCount: row.viewCount,
        hasAttachment: Boolean(row.hasAttachment),
        eventStartDate: row.eventStartDate
          ? msToIso(row.eventStartDate.valueOf())
          : undefined,
        eventEndDate: row.eventEndDate
          ? msToIso(row.eventEndDate.valueOf())
          : undefined,
        eventDescription: row.eventDescription ?? undefined,
        surveyId: row.surveyId ?? undefined,
      })),
    };
  }

  async findAllArticles(
    limit: number,
    query?: string,
  ): Promise<ArticleListItem[]> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;

    const baseFilter = and(
      eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      searchFilter,
    );

    const rows = await this.db
      .select({
        articleId: articles.articleId,
        boardId: articles.boardId,
        boardCode: boards.code,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        status: articles.status,
        visibilityScope: articles.visibilityScope,
        isPinned: articles.isPinned,
        pinOrder: articles.pinOrder,
        isAnonymous: articles.isAnonymous,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        hasAttachment: sql<boolean>`exists (
          select 1
          from ${articleAssets}
          where ${articleAssets.articleId} = ${articles.articleId}
            and ${articleAssets.usageType} = 'ATTACHMENT'
        )`,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescription: articles.eventDescription,
        surveyId: surveys.surveyId,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(boards, eq(articles.boardId, boards.boardId))
      .leftJoin(surveys, eq(surveys.connectedArticleId, articles.articleId))
      .where(baseFilter)
      .orderBy(desc(articles.postedAt))
      .limit(limit);

    return rows.map((row) => ({
      articleId: String(row.articleId),
      boardId: row.boardId,
      boardCode: row.boardCode ?? undefined,
      titleKo: row.titleKo,
      titleEn: row.titleEn ?? undefined,
      status: row.status as ArticleListItem["status"],
      visibilityScope:
        row.visibilityScope as ArticleListItem["visibilityScope"],
      isPinned: row.isPinned,
      pinOrder: row.pinOrder ?? null,
      isAnonymous: row.isAnonymous,
      postedAt: msToIso(row.postedAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
      author: {
        userId: String(row.authorId ?? ""),
        name: row.authorName ?? "unknown",
      },
      commentCount: 0, // Not needed for search
      viewCount: row.viewCount,
      hasAttachment: Boolean(row.hasAttachment),
      eventStartDate: row.eventStartDate ? msToIso(row.eventStartDate.valueOf()) : undefined,
      eventEndDate: row.eventEndDate ? msToIso(row.eventEndDate.valueOf()) : undefined,
      eventDescription: row.eventDescription ?? undefined,
      surveyId: row.surveyId ?? undefined,
    }));
  }

  async findDetailById(
    boardId: number,
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
        isAnonymous: articles.isAnonymous,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescription: articles.eventDescription,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, Number(articleId)),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
        ),
      )
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
      .where(eq(articleAssets.articleId, Number(articleId)))
      .orderBy(asc(articleAssets.sortOrder));

    const surveyRow = await this.db
      .select()
      .from(surveys)
      .where(eq(surveys.connectedArticleId, Number(articleId)))
      .limit(1);

    const prevRow = await this.db
      .select({
        articleId: articles.articleId,
        titleKo: articles.titleKo,
        postedAt: articles.postedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        isAnonymous: articles.isAnonymous,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
          lt(articles.postedAt, row[0].postedAt)
        )
      )
      .orderBy(desc(articles.postedAt))
      .limit(1);

    const nextRow = await this.db
      .select({
        articleId: articles.articleId,
        titleKo: articles.titleKo,
        postedAt: articles.postedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        isAnonymous: articles.isAnonymous,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
          gt(articles.postedAt, row[0].postedAt)
        )
      )
      .orderBy(asc(articles.postedAt))
      .limit(1);

    return {
      articleId: String(row[0].articleId),
      boardId: row[0].boardId,
      titleKo: row[0].titleKo,
      titleEn: row[0].titleEn ?? undefined,
      contentKo: row[0].contentKo,
      contentEn: row[0].contentEn ?? undefined,
      status: row[0].status as ArticleDetailResponse["status"],
      visibilityScope: row[0]
        .visibilityScope as ArticleDetailResponse["visibilityScope"],
      isPinned: row[0].isPinned,
      pinOrder: row[0].pinOrder ?? null,
      isAnonymous: row[0].isAnonymous,
      postedAt: msToIso(row[0].postedAt.valueOf()),
      updatedAt: msToIso(row[0].updatedAt.valueOf()),
      author: {
        userId: String(row[0].authorId ?? ""),
        name: row[0].authorName ?? "unknown",
      },
      assets: assetRows.map((assetRow) => ({
        assetId: String(assetRow.assetId),
        usageType:
          assetRow.usageType as ArticleDetailResponse["assets"][number]["usageType"],
        sortOrder: assetRow.sortOrder,
        originalFilename: assetRow.originalFilename,
        mimeType: assetRow.mimeType,
        sizeBytes: assetRow.sizeBytes,
        storageKey: assetRow.storageKey,
      })),
      commentCount: Number(row[0].commentCount ?? 0),
      viewCount: row[0].viewCount,
      eventStartDate: row[0].eventStartDate ? msToIso(row[0].eventStartDate.valueOf()) : undefined,
      eventEndDate: row[0].eventEndDate ? msToIso(row[0].eventEndDate.valueOf()) : undefined,
      eventDescription: row[0].eventDescription ?? undefined,
      survey: surveyRow[0]
        ? {
            surveyId: surveyRow[0].surveyId,
            kind: surveyRow[0].kind,
            titleKo: surveyRow[0].titleKo,
            titleEn: surveyRow[0].titleEn ?? undefined,
            descriptionKo: surveyRow[0].descriptionKo ?? undefined,
            descriptionEn: surveyRow[0].descriptionEn ?? undefined,
            status: surveyRow[0].status,
            computedState: (() => {
              const now = Date.now();
              const openAt = surveyRow[0].openAt?.getTime();
              const closeAt = surveyRow[0].closeAt?.getTime();
              const status = surveyRow[0].status.toLowerCase();
              if (openAt && openAt > now) return "before_open";
              if (closeAt && closeAt <= now) return "closed";
              if (status === "open") return "open";
              if (status === "scheduled" && openAt && openAt <= now) return "open";
              return "closed";
            })(),
            feeRequirementPolicy: surveyRow[0].feeRequirementPolicy,
            openAt: surveyRow[0].openAt ? msToIso(surveyRow[0].openAt.valueOf()) : undefined,
            closeAt: surveyRow[0].closeAt ? msToIso(surveyRow[0].closeAt.valueOf()) : undefined,
          }
        : null,
      prevArticle: prevRow[0]
        ? {
            articleId: String(prevRow[0].articleId),
            titleKo: prevRow[0].titleKo,
            postedAt: msToIso(prevRow[0].postedAt.valueOf()),
            isAnonymous: prevRow[0].isAnonymous,
            author: {
              userId: String(prevRow[0].authorId ?? ""),
              name: prevRow[0].authorName ?? "unknown",
            },
          }
        : null,
      nextArticle: nextRow[0]
        ? {
            articleId: String(nextRow[0].articleId),
            titleKo: nextRow[0].titleKo,
            postedAt: msToIso(nextRow[0].postedAt.valueOf()),
            isAnonymous: nextRow[0].isAnonymous,
            author: {
              userId: String(nextRow[0].authorId ?? ""),
              name: nextRow[0].authorName ?? "unknown",
            },
          }
        : null,
    };
  }

  async createArticle(input: {
    boardId: number;
    authorUserId: string;
    payload: ArticleCreateRequest;
  }): Promise<ArticleCreateResponse> {
    const now = nowDate();

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
                  isAnonymous: input.payload.isAnonymous ?? false,
          postedAt: now,
          updatedAt: now,
          eventStartDate: input.payload.eventStartDate ? new Date(input.payload.eventStartDate) : null,
          eventEndDate: input.payload.eventEndDate ? new Date(input.payload.eventEndDate) : null,
          eventDescription: input.payload.eventDescription ?? null,
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
            assetId: Number(asset.assetId),
            usageType: asset.usageType,
            sortOrder: asset.sortOrder,
          })),
        );
      }

      return {
        articleId: String(created.articleId),
        boardId: created.boardId,
        postedAt: msToIso(created.postedAt.valueOf()),
      };
    });
  }

  async findPermissionInfo(
    boardId: number,
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
      .where(
        and(eq(articles.boardId, boardId), eq(articles.articleId, Number(articleId))),
      )
      .limit(1);

    if (!row[0]) return null;

    return {
      authorUserId: String(row[0].authorUserId),
      status: row[0].status,
    };
  }

  async updateArticle(
    boardId: number,
    articleId: string,
    payload: ArticleUpdateRequest,
  ): Promise<ArticleUpdateResponse> {
    const now = nowDate();
    const updateSet: {
      titleKo?: string;
      titleEn?: string | null;
      contentKo?: string;
      contentEn?: string | null;
      visibilityScope?: string;
      isPinned?: boolean;
      pinOrder?: number | null;
      isAnonymous?: boolean;
      updatedAt: Date;
      eventStartDate?: Date | null;
      eventEndDate?: Date | null;
      eventDescription?: string | null;
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

    if (payload.isAnonymous !== undefined) {
      updateSet.isAnonymous = payload.isAnonymous;
    }

    if (payload.eventStartDate !== undefined) {
      updateSet.eventStartDate = payload.eventStartDate ? new Date(payload.eventStartDate) : null;
    }

    if (payload.eventEndDate !== undefined) {
      updateSet.eventEndDate = payload.eventEndDate ? new Date(payload.eventEndDate) : null;
    }

    if (payload.eventDescription !== undefined) {
      updateSet.eventDescription = payload.eventDescription ?? null;
    }

    return this.db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set(updateSet)
        .where(
          and(eq(articles.boardId, boardId), eq(articles.articleId, Number(articleId))),
        );

      if (payload.assets) {
        await tx
          .delete(articleAssets)
          .where(eq(articleAssets.articleId, Number(articleId)));

        if (payload.assets.length > 0) {
          await tx.insert(articleAssets).values(
            payload.assets.map((asset) => ({
              articleId: Number(articleId),
              assetId: Number(asset.assetId),
              usageType: asset.usageType,
              sortOrder: asset.sortOrder,
            })),
          );
        }
      }

      return {
        articleId: String(articleId),
        updatedAt: msToIso(now.valueOf()),
      };
    });
  }

  async softDeleteArticle(
    boardId: number,
    articleId: string,
  ): Promise<ArticleDeleteResponse> {
    const now = nowDate();

    await this.db
      .update(articles)
      .set({
        status: ARTICLE_STATUS.DELETED,
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(articles.boardId, boardId), eq(articles.articleId, Number(articleId))),
      );

    return {
      ok: true,
      articleId: String(articleId),
      deletedAt: msToIso(now.valueOf()),
    };
  }

  async isReadableArticle(
    boardId: number,
    articleId: string,
  ): Promise<boolean> {
    const row = await this.db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, Number(articleId)),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
        ),
      )
      .limit(1);

    return Boolean(row[0]);
  }

  async incrementViewCount(articleId: string): Promise<void> {
    await this.db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.articleId, Number(articleId)));
  }
}
