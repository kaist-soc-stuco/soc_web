import { BadRequestException, Inject, Injectable } from "@nestjs/common";
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
  ArticleEngagementKind,
  SurveySummary,
  VisibilityScope,
} from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleAssets,
  articleEngagements,
  articleViews,
  articles,
  assets,
  comments,
  users,
  surveys,
  surveyResponses,
  boards,
} from "../../../infrastructure/postgres/postgres.schema";
import { ARTICLE_STATUS, COMMENT_STATUS } from "../board.constants";
import { isoToDate, msToIso, nowDate, nowMs } from "@soc/shared";
import { toAssetReference } from "../../asset/asset-reference";
import { areArticleAssetsAttachable } from "../article-asset-access";

const getConnectedSurveyState = (survey: typeof surveys.$inferSelect): "before_open" | "open" | "closed" => {
  if (!survey.isPublished) return "closed";
  if (survey.isAlwaysOpen) return "open";

  const now = nowMs();
  const openAt = survey.openAt?.valueOf();
  const closeAt = survey.closeAt?.valueOf();

  if (openAt !== undefined && openAt > now) return "before_open";
  if (closeAt !== undefined && closeAt <= now) return "closed";
  return "open";
};

type ConnectedSurveyFields = {
  surveyId: string | null;
  surveyKind: string | null;
  surveyTitleKo: string | null;
  surveyTitleEn: string | null;
  surveyDescriptionKo: string | null;
  surveyDescriptionEn: string | null;
  surveyComputedState: string | null;
  surveyFeeRequirementPolicy: string | null;
  surveyIsAlwaysOpen: boolean | null;
  surveyOpenAt: Date | null;
  surveyCloseAt: Date | null;
  surveyMaxResponses: number | null;
  surveyResponseCount: number | null;
};

const connectedSurveyFields = {
  surveyId: surveys.surveyId,
  surveyKind: surveys.kind,
  surveyTitleKo: surveys.titleKo,
  surveyTitleEn: surveys.titleEn,
  surveyDescriptionKo: surveys.descriptionKo,
  surveyDescriptionEn: surveys.descriptionEn,
  surveyComputedState: sql<string | null>`case
    when ${surveys.surveyId} is null then null
    when ${surveys.isAlwaysOpen} then 'open'
    when ${surveys.openAt} is not null and ${surveys.openAt} > now() then 'before_open'
    when ${surveys.closeAt} is not null and ${surveys.closeAt} <= now() then 'closed'
    else 'open'
  end`,
  surveyFeeRequirementPolicy: surveys.feeRequirementPolicy,
  surveyIsAlwaysOpen: surveys.isAlwaysOpen,
  surveyOpenAt: surveys.openAt,
  surveyCloseAt: surveys.closeAt,
  surveyMaxResponses: surveys.maxResponseCount,
  surveyResponseCount: sql<number | null>`case
    when ${surveys.surveyId} is null then null
    else (
      select count(*)::int
      from ${surveyResponses}
      where ${surveyResponses.surveyId} = ${surveys.surveyId}
        and ${surveyResponses.status} != 'draft'
    )
  end`,
};

const mapConnectedSurvey = (
  row: ConnectedSurveyFields,
): SurveySummary | null => {
  if (!row.surveyId) return null;

  return {
    surveyId: row.surveyId,
    kind: row.surveyKind ?? "EVENT",
    titleKo: row.surveyTitleKo ?? "",
    titleEn: row.surveyTitleEn ?? undefined,
    descriptionKo: row.surveyDescriptionKo ?? undefined,
    descriptionEn: row.surveyDescriptionEn ?? undefined,
    computedState: row.surveyComputedState ?? "closed",
    feeRequirementPolicy: row.surveyFeeRequirementPolicy ?? "NONE",
    isAlwaysOpen: Boolean(row.surveyIsAlwaysOpen),
    openAt: row.surveyOpenAt ? msToIso(row.surveyOpenAt.valueOf()) : undefined,
    closeAt: row.surveyCloseAt ? msToIso(row.surveyCloseAt.valueOf()) : undefined,
    maxResponses: row.surveyMaxResponses ?? null,
    responseCount: Number(row.surveyResponseCount ?? 0),
  };
};

const articleThumbnailStorageKey = sql<string | null>`(
  select concat('asset:', ${assets.assetId}::text)
  from ${articleAssets}
  inner join ${assets} on ${assets.assetId} = ${articleAssets.assetId}
  where ${articleAssets.articleId} = ${articles.articleId}
    and ${articleAssets.usageType} in ('THUMBNAIL', 'IMAGE')
  order by
    case when ${articleAssets.usageType} = 'THUMBNAIL' then 0 else 1 end,
    ${articleAssets.sortOrder} asc
  limit 1
)`;

const articleEngagementCount = (kind: ArticleEngagementKind) => sql<number>`(
  select count(*)::int
  from ${articleEngagements}
  where ${articleEngagements.articleId} = ${articles.articleId}
    and ${articleEngagements.kind} = ${kind}
)`;

const viewerHasEngagement = (
  userId: string | undefined,
  kind: ArticleEngagementKind,
) =>
  userId
    ? sql<boolean>`exists (
        select 1
        from ${articleEngagements}
        where ${articleEngagements.articleId} = ${articles.articleId}
          and ${articleEngagements.userId} = ${userId}
          and ${articleEngagements.kind} = ${kind}
      )`
    : sql<boolean>`false`;

@Injectable()
export class ArticleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listByBoardId(
    boardId: number,
    page: number,
    limit: number,
    visibilityScopes: VisibilityScope[],
    query?: string,
    viewerUserId?: string,
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
      inArray(articles.visibilityScope, visibilityScopes),
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
        isSecret: articles.isSecret,
        isAnonymous: articles.isAnonymous,
        allowComment: articles.allowComment,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        likeCount: articleEngagementCount("LIKE"),
        scrapCount: articleEngagementCount("SCRAP"),
        viewerHasLiked: viewerHasEngagement(viewerUserId, "LIKE"),
        viewerHasScrapped: viewerHasEngagement(viewerUserId, "SCRAP"),
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
        thumbnailStorageKey: articleThumbnailStorageKey,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescriptionKo: articles.eventDescriptionKo,
        eventDescriptionEn: articles.eventDescriptionEn,
        ...connectedSurveyFields,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(
        surveys,
        and(eq(surveys.connectedArticleId, articles.articleId), eq(surveys.isPublished, true)),
      )
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
        isSecret: row.isSecret,
        isAnonymous: row.isAnonymous,
        allowComment: row.allowComment,
        postedAt: msToIso(row.postedAt.valueOf()),
        updatedAt: msToIso(row.updatedAt.valueOf()),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.authorName ?? "unknown",
        },
        commentCount: Number(row.commentCount ?? 0),
        viewCount: row.viewCount,
        likeCount: Number(row.likeCount ?? 0),
        scrapCount: Number(row.scrapCount ?? 0),
        viewerHasLiked: Boolean(row.viewerHasLiked),
        viewerHasScrapped: Boolean(row.viewerHasScrapped),
        hasAttachment: Boolean(row.hasAttachment),
        thumbnailStorageKey: row.thumbnailStorageKey ?? undefined,
        eventStartDate: row.eventStartDate ? msToIso(row.eventStartDate.valueOf()) : undefined,
        eventEndDate: row.eventEndDate ? msToIso(row.eventEndDate.valueOf()) : undefined,
        eventDescriptionKo: row.eventDescriptionKo ?? undefined,
        eventDescriptionEn: row.eventDescriptionEn ?? undefined,
        surveyId: row.surveyId ?? undefined,
        survey: mapConnectedSurvey(row),
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
      sortDirection: "asc" | "desc";
      visibilityScopes: VisibilityScope[];
      viewerUserId?: string;
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
        : params.searchBy === "title_content"
          ? or(
              ilike(articles.titleKo, `%${normalizedQuery}%`),
              ilike(articles.titleEn, `%${normalizedQuery}%`),
              ilike(articles.contentKo, `%${normalizedQuery}%`),
              ilike(articles.contentEn, `%${normalizedQuery}%`),
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
      inArray(articles.visibilityScope, params.visibilityScopes),
      searchFilter,
      cutoffFilter,
    );

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(baseFilter);

    const primarySort =
      params.sortBy === "views"
        ? params.sortDirection === "asc"
          ? asc(articles.viewCount)
          : desc(articles.viewCount)
        : params.sortDirection === "asc"
          ? asc(articles.postedAt)
          : desc(articles.postedAt);

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
        isSecret: articles.isSecret,
        isAnonymous: articles.isAnonymous,
        allowComment: articles.allowComment,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        likeCount: articleEngagementCount("LIKE"),
        scrapCount: articleEngagementCount("SCRAP"),
        viewerHasLiked: viewerHasEngagement(params.viewerUserId, "LIKE"),
        viewerHasScrapped: viewerHasEngagement(params.viewerUserId, "SCRAP"),
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
        thumbnailStorageKey: articleThumbnailStorageKey,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescriptionKo: articles.eventDescriptionKo,
        eventDescriptionEn: articles.eventDescriptionEn,
        ...connectedSurveyFields,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(boards, eq(articles.boardId, boards.boardId))
      .leftJoin(
        surveys,
        and(eq(surveys.connectedArticleId, articles.articleId), eq(surveys.isPublished, true)),
      )
      .where(baseFilter)
      .orderBy(
        desc(articles.isPinned),
        asc(sql`coalesce(${articles.pinOrder}, 2147483647)`),
        primarySort,
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
        isSecret: row.isSecret,
        isAnonymous: row.isAnonymous,
        allowComment: row.allowComment,
        postedAt: msToIso(row.postedAt.valueOf()),
        updatedAt: msToIso(row.updatedAt.valueOf()),
        author: {
          userId: String(row.authorId ?? ""),
          name: row.authorName ?? "unknown",
        },
        commentCount: Number(row.commentCount ?? 0),
        viewCount: row.viewCount,
        likeCount: Number(row.likeCount ?? 0),
        scrapCount: Number(row.scrapCount ?? 0),
        viewerHasLiked: Boolean(row.viewerHasLiked),
        viewerHasScrapped: Boolean(row.viewerHasScrapped),
        hasAttachment: Boolean(row.hasAttachment),
        thumbnailStorageKey: row.thumbnailStorageKey ?? undefined,
        eventStartDate: row.eventStartDate
          ? msToIso(row.eventStartDate.valueOf())
          : undefined,
        eventEndDate: row.eventEndDate
          ? msToIso(row.eventEndDate.valueOf())
          : undefined,
        eventDescriptionKo: row.eventDescriptionKo ?? undefined,
        eventDescriptionEn: row.eventDescriptionEn ?? undefined,
        surveyId: row.surveyId ?? undefined,
        survey: mapConnectedSurvey(row),
      })),
    };
  }

  async findAllArticles(
    limit: number,
    query?: string,
    boardIds: number[] = [],
    visibilityScopes: VisibilityScope[] = ["PUBLIC"],
    viewerUserId?: string,
  ): Promise<ArticleListItem[]> {
    if (boardIds.length === 0) {
      return [];
    }

    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;

    const baseFilter = and(
      inArray(articles.boardId, boardIds),
      eq(articles.status, ARTICLE_STATUS.PUBLISHED),
      inArray(articles.visibilityScope, visibilityScopes),
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
        isSecret: articles.isSecret,
        isAnonymous: articles.isAnonymous,
        allowComment: articles.allowComment,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        likeCount: articleEngagementCount("LIKE"),
        scrapCount: articleEngagementCount("SCRAP"),
        viewerHasLiked: viewerHasEngagement(viewerUserId, "LIKE"),
        viewerHasScrapped: viewerHasEngagement(viewerUserId, "SCRAP"),
        hasAttachment: sql<boolean>`exists (
          select 1
          from ${articleAssets}
          where ${articleAssets.articleId} = ${articles.articleId}
            and ${articleAssets.usageType} = 'ATTACHMENT'
        )`,
        thumbnailStorageKey: articleThumbnailStorageKey,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescriptionKo: articles.eventDescriptionKo,
        eventDescriptionEn: articles.eventDescriptionEn,
        ...connectedSurveyFields,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .leftJoin(boards, eq(articles.boardId, boards.boardId))
      .leftJoin(
        surveys,
        and(eq(surveys.connectedArticleId, articles.articleId), eq(surveys.isPublished, true)),
      )
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
      isSecret: row.isSecret,
      isAnonymous: row.isAnonymous,
      allowComment: row.allowComment,
      postedAt: msToIso(row.postedAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
      author: {
        userId: String(row.authorId ?? ""),
        name: row.authorName ?? "unknown",
      },
      commentCount: 0, // Not needed for search
      viewCount: row.viewCount,
      likeCount: Number(row.likeCount ?? 0),
      scrapCount: Number(row.scrapCount ?? 0),
      viewerHasLiked: Boolean(row.viewerHasLiked),
      viewerHasScrapped: Boolean(row.viewerHasScrapped),
      hasAttachment: Boolean(row.hasAttachment),
      thumbnailStorageKey: row.thumbnailStorageKey ?? undefined,
      eventStartDate: row.eventStartDate ? msToIso(row.eventStartDate.valueOf()) : undefined,
      eventEndDate: row.eventEndDate ? msToIso(row.eventEndDate.valueOf()) : undefined,
      eventDescriptionKo: row.eventDescriptionKo ?? undefined,
      eventDescriptionEn: row.eventDescriptionEn ?? undefined,
      surveyId: row.surveyId ?? undefined,
      survey: mapConnectedSurvey(row),
    }));
  }

  async findDetailById(
    boardId: number,
    articleId: string,
    visibilityScopes: VisibilityScope[],
    viewerUserId?: string,
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
        isSecret: articles.isSecret,
        isAnonymous: articles.isAnonymous,
        allowComment: articles.allowComment,
        postedAt: articles.postedAt,
        updatedAt: articles.updatedAt,
        authorId: users.userId,
        authorName: users.nameKo,
        viewCount: articles.viewCount,
        likeCount: articleEngagementCount("LIKE"),
        scrapCount: articleEngagementCount("SCRAP"),
        viewerHasLiked: viewerHasEngagement(viewerUserId, "LIKE"),
        viewerHasScrapped: viewerHasEngagement(viewerUserId, "SCRAP"),
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = ${COMMENT_STATUS.PUBLISHED}
        )`,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
        eventDescriptionKo: articles.eventDescriptionKo,
        eventDescriptionEn: articles.eventDescriptionEn,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorUserId, users.userId))
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, Number(articleId)),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
          inArray(articles.visibilityScope, visibilityScopes),
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
      .where(and(eq(surveys.connectedArticleId, Number(articleId)), eq(surveys.isPublished, true)))
      .limit(1);

    const prevRow = await this.db
      .select({
        articleId: articles.articleId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
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
          inArray(articles.visibilityScope, visibilityScopes),
          lt(articles.postedAt, row[0].postedAt)
        )
      )
      .orderBy(desc(articles.postedAt))
      .limit(1);

    const nextRow = await this.db
      .select({
        articleId: articles.articleId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
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
          inArray(articles.visibilityScope, visibilityScopes),
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
      isSecret: row[0].isSecret,
      isAnonymous: row[0].isAnonymous,
      allowComment: row[0].allowComment,
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
        storageKey: toAssetReference(assetRow.assetId),
      })),
      commentCount: Number(row[0].commentCount ?? 0),
      viewCount: row[0].viewCount,
      likeCount: Number(row[0].likeCount ?? 0),
      scrapCount: Number(row[0].scrapCount ?? 0),
      viewerHasLiked: Boolean(row[0].viewerHasLiked),
      viewerHasScrapped: Boolean(row[0].viewerHasScrapped),
      eventStartDate: row[0].eventStartDate ? msToIso(row[0].eventStartDate.valueOf()) : undefined,
      eventEndDate: row[0].eventEndDate ? msToIso(row[0].eventEndDate.valueOf()) : undefined,
      eventDescriptionKo: row[0].eventDescriptionKo ?? undefined,
      eventDescriptionEn: row[0].eventDescriptionEn ?? undefined,
      survey: surveyRow[0]
        ? {
            surveyId: surveyRow[0].surveyId,
            kind: surveyRow[0].kind,
            titleKo: surveyRow[0].titleKo,
            titleEn: surveyRow[0].titleEn ?? undefined,
            descriptionKo: surveyRow[0].descriptionKo ?? undefined,
            descriptionEn: surveyRow[0].descriptionEn ?? undefined,
            computedState: getConnectedSurveyState(surveyRow[0]),
            feeRequirementPolicy: surveyRow[0].feeRequirementPolicy,
            isAlwaysOpen: surveyRow[0].isAlwaysOpen,
            openAt: surveyRow[0].openAt ? msToIso(surveyRow[0].openAt.valueOf()) : undefined,
          }
        : null,
      prevArticle: prevRow[0]
        ? {
            articleId: String(prevRow[0].articleId),
            titleKo: prevRow[0].titleKo,
            titleEn: prevRow[0].titleEn ?? undefined,
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
            titleEn: nextRow[0].titleEn ?? undefined,
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
      if (input.payload.assets && input.payload.assets.length > 0) {
        const requestedAssetIds = input.payload.assets.map((asset) =>
          Number(asset.assetId),
        );
        const assetRows = await tx
          .select({
            assetId: assets.assetId,
            uploadedBy: assets.uploadedBy,
          })
          .from(assets)
          .where(inArray(assets.assetId, requestedAssetIds))
          .for("update");
        const existingLinks = await tx
          .select({ assetId: articleAssets.assetId })
          .from(articleAssets)
          .where(inArray(articleAssets.assetId, requestedAssetIds));

        if (!areArticleAssetsAttachable({
          actingUserId: input.authorUserId,
          requestedAssetIds,
          assets: assetRows.map((asset) => ({
            assetId: asset.assetId,
            uploadedBy: String(asset.uploadedBy),
          })),
          links: existingLinks.map((link) => ({
            articleId: -1,
            assetId: link.assetId,
          })),
        })) {
          throw new BadRequestException("article_asset_not_attachable");
        }
      }

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
          isSecret: input.payload.isSecret ?? false,
          isAnonymous: input.payload.isAnonymous ?? false,
          allowComment: input.payload.allowComment ?? true,
          postedAt: now,
          updatedAt: now,
          eventStartDate: input.payload.eventStartDate ? isoToDate(input.payload.eventStartDate) : null,
          eventEndDate: input.payload.eventEndDate ? isoToDate(input.payload.eventEndDate) : null,
          eventDescriptionKo: input.payload.eventDescriptionKo ?? null,
          eventDescriptionEn: input.payload.eventDescriptionEn ?? null,
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

  async findCommentPermissionInfo(
    boardId: number,
    articleId: string,
    visibilityScopes: VisibilityScope[],
  ): Promise<{
    allowComment: boolean;
    status: string;
  } | null> {
    const row = await this.db
      .select({
        allowComment: articles.allowComment,
        status: articles.status,
      })
      .from(articles)
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, Number(articleId)),
          inArray(articles.visibilityScope, visibilityScopes),
        ),
      )
      .limit(1);

    if (!row[0]) return null;

    return {
      allowComment: row[0].allowComment,
      status: row[0].status,
    };
  }

  async updateArticle(
    boardId: number,
    articleId: string,
    payload: ArticleUpdateRequest,
    actingUserId: string,
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
      isSecret?: boolean;
      isAnonymous?: boolean;
      allowComment?: boolean;
      updatedAt: Date;
      eventStartDate?: Date | null;
      eventEndDate?: Date | null;
      eventDescriptionKo?: string | null;
      eventDescriptionEn?: string | null;
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

    if (payload.isSecret !== undefined) {
      updateSet.isSecret = payload.isSecret;
    }

    if (payload.isAnonymous !== undefined) {
      updateSet.isAnonymous = payload.isAnonymous;
    }

    if (payload.allowComment !== undefined) {
      updateSet.allowComment = payload.allowComment;
    }

    if (payload.eventStartDate !== undefined) {
      updateSet.eventStartDate = payload.eventStartDate ? isoToDate(payload.eventStartDate) : null;
    }

    if (payload.eventEndDate !== undefined) {
      updateSet.eventEndDate = payload.eventEndDate ? isoToDate(payload.eventEndDate) : null;
    }

    if (payload.eventDescriptionKo !== undefined) {
      updateSet.eventDescriptionKo = payload.eventDescriptionKo ?? null;
    }

    if (payload.eventDescriptionEn !== undefined) {
      updateSet.eventDescriptionEn = payload.eventDescriptionEn ?? null;
    }

    return this.db.transaction(async (tx) => {
      if (payload.assets && payload.assets.length > 0) {
        const requestedAssetIds = payload.assets.map((asset) =>
          Number(asset.assetId),
        );
        const assetRows = await tx
          .select({
            assetId: assets.assetId,
            uploadedBy: assets.uploadedBy,
          })
          .from(assets)
          .where(inArray(assets.assetId, requestedAssetIds))
          .for("update");
        const existingLinks = await tx
          .select({
            articleId: articleAssets.articleId,
            assetId: articleAssets.assetId,
          })
          .from(articleAssets)
          .where(inArray(articleAssets.assetId, requestedAssetIds));
        if (!areArticleAssetsAttachable({
          actingUserId,
          currentArticleId: Number(articleId),
          requestedAssetIds,
          assets: assetRows.map((asset) => ({
            assetId: asset.assetId,
            uploadedBy: String(asset.uploadedBy),
          })),
          links: existingLinks,
        })) {
          throw new BadRequestException("article_asset_not_attachable");
        }
      }

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
    visibilityScopes: VisibilityScope[],
  ): Promise<boolean> {
    const row = await this.db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(
        and(
          eq(articles.boardId, boardId),
          eq(articles.articleId, Number(articleId)),
          eq(articles.status, ARTICLE_STATUS.PUBLISHED),
          inArray(articles.visibilityScope, visibilityScopes),
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

  async recordArticleView(articleId: string, userId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(articleViews)
        .values({
          articleId: Number(articleId),
          userId,
        })
        .onConflictDoNothing()
        .returning({ articleId: articleViews.articleId });

      if (inserted.length === 0) return false;

      await tx
        .update(articles)
        .set({ viewCount: sql`${articles.viewCount} + 1` })
        .where(eq(articles.articleId, Number(articleId)));

      return true;
    });
  }

  async setArticleEngagement(
    articleId: string,
    userId: string,
    kind: ArticleEngagementKind,
    active: boolean,
  ): Promise<void> {
    const normalizedArticleId = Number(articleId);

    if (active) {
      await this.db
        .insert(articleEngagements)
        .values({
          articleId: normalizedArticleId,
          userId,
          kind,
        })
        .onConflictDoNothing();
      return;
    }

    await this.db
      .delete(articleEngagements)
      .where(
        and(
          eq(articleEngagements.articleId, normalizedArticleId),
          eq(articleEngagements.userId, userId),
          eq(articleEngagements.kind, kind),
        ),
      );
  }

  async getArticleEngagementSummary(
    articleId: string,
    viewerUserId: string,
  ): Promise<{
    likeCount: number;
    scrapCount: number;
    viewerHasLiked: boolean;
    viewerHasScrapped: boolean;
  }> {
    const rows = await this.db
      .select({
        likeCount: articleEngagementCount("LIKE"),
        scrapCount: articleEngagementCount("SCRAP"),
        viewerHasLiked: viewerHasEngagement(viewerUserId, "LIKE"),
        viewerHasScrapped: viewerHasEngagement(viewerUserId, "SCRAP"),
      })
      .from(articles)
      .where(eq(articles.articleId, Number(articleId)))
      .limit(1);

    return {
      likeCount: Number(rows[0]?.likeCount ?? 0),
      scrapCount: Number(rows[0]?.scrapCount ?? 0),
      viewerHasLiked: Boolean(rows[0]?.viewerHasLiked),
      viewerHasScrapped: Boolean(rows[0]?.viewerHasScrapped),
    };
  }
}
