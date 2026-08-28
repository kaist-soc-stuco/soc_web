import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleDrafts,
  boards,
} from "../../../infrastructure/postgres/postgres.schema";

type DraftPayload = Record<string, unknown>;

type DraftSelectRow = {
  draftId: string;
  boardId: number;
  boardCode: string | null;
  targetArticleId: number | null;
  titleKo: string;
  titleEn: string | null;
  contentKo: string;
  contentEn: string | null;
  fingerprint: string;
  version: number;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const toOptionalString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const toOptionalBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const toOptionalNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const mapRow = (row: DraftSelectRow): ArticleDraftRecord => {
  const payload = (row.payload ?? {}) as DraftPayload;
  const assets = Array.isArray(payload.assets)
    ? (payload.assets as ArticleDraftRecord["assets"])
    : undefined;

  return {
    draftId: row.draftId,
    boardId: row.boardId,
    boardCode: row.boardCode ?? "",
    targetArticleId:
      row.targetArticleId === null ? null : String(row.targetArticleId),
    titleKo: row.titleKo,
    titleEn: row.titleEn,
    contentKo: row.contentKo,
    contentEn: row.contentEn,
    visibilityScope:
      (payload.visibilityScope as ArticleDraftRecord["visibilityScope"]) ??
      "PUBLIC",
    isPinned: toOptionalBoolean(payload.isPinned, false),
    pinOrder: toOptionalNumber(payload.pinOrder),
    isSecret: toOptionalBoolean(payload.isSecret, false),
    isAnonymous: toOptionalBoolean(payload.isAnonymous, false),
    isOfficial: toOptionalBoolean(payload.isOfficial, false),
    allowComment: toOptionalBoolean(payload.allowComment, true),
    isKoreanOnly: toOptionalBoolean(payload.isKoreanOnly, false),
    assets,
    eventStartDate: toOptionalString(payload.eventStartDate),
    eventEndDate: toOptionalString(payload.eventEndDate),
    eventDescriptionKo: toOptionalString(payload.eventDescriptionKo),
    eventDescriptionEn: toOptionalString(payload.eventDescriptionEn),
    linkedSurveyId: toOptionalString(payload.linkedSurveyId),
    fingerprint: row.fingerprint,
    version: row.version,
    createdAt: msToIso(row.createdAt.valueOf()),
    updatedAt: msToIso(row.updatedAt.valueOf()),
  };
};

const selectDraftColumns = {
  draftId: articleDrafts.draftId,
  boardId: articleDrafts.boardId,
  boardCode: boards.code,
  targetArticleId: articleDrafts.targetArticleId,
  titleKo: articleDrafts.titleKo,
  titleEn: articleDrafts.titleEn,
  contentKo: articleDrafts.contentKo,
  contentEn: articleDrafts.contentEn,
  fingerprint: articleDrafts.fingerprint,
  version: articleDrafts.version,
  payload: articleDrafts.payload,
  createdAt: articleDrafts.createdAt,
  updatedAt: articleDrafts.updatedAt,
};

@Injectable()
export class ArticleDraftRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async findById(
    ownerUserId: string,
    draftId: string,
  ): Promise<ArticleDraftRecord | null> {
    const rows = await this.db
      .select(selectDraftColumns)
      .from(articleDrafts)
      .innerJoin(boards, eq(articleDrafts.boardId, boards.boardId))
      .where(
        and(
          eq(articleDrafts.ownerUserId, ownerUserId),
          eq(articleDrafts.draftId, draftId),
        ),
      )
      .limit(1);

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async listByOwner(
    ownerUserId: string,
    page: number,
    limit: number,
    boardCode?: string,
  ): Promise<{ items: ArticleDraftRecord[]; total: number }> {
    const boardFilter = boardCode ? eq(boards.code, boardCode) : undefined;
    const where = and(eq(articleDrafts.ownerUserId, ownerUserId), boardFilter);

    const [totalRow, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(articleDrafts)
        .innerJoin(boards, eq(articleDrafts.boardId, boards.boardId))
        .where(where),
      this.db
        .select(selectDraftColumns)
        .from(articleDrafts)
        .innerJoin(boards, eq(articleDrafts.boardId, boards.boardId))
        .where(where)
        .orderBy(desc(articleDrafts.updatedAt), asc(articleDrafts.draftId))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    return {
      total: Number(totalRow[0]?.count ?? 0),
      items: rows.map((row) => mapRow(row)),
    };
  }

  async create(
    ownerUserId: string,
    boardId: number,
    input: ArticleDraftSaveRequest,
  ): Promise<ArticleDraftRecord> {
    const now = nowDate();
    const payload: DraftPayload = { ...input };
    delete payload.draftId;
    delete payload.expectedVersion;
    delete payload.fingerprint;
    delete payload.boardCode;

    const [created] = await this.db
      .insert(articleDrafts)
      .values({
        ownerUserId,
        boardId,
        targetArticleId: input.targetArticleId
          ? Number(input.targetArticleId)
          : null,
        titleKo: input.titleKo,
        titleEn: input.titleEn ?? null,
        contentKo: input.contentKo,
        contentEn: input.contentEn ?? null,
        fingerprint: input.fingerprint,
        payload,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ draftId: articleDrafts.draftId });

    const result = created
      ? await this.findById(ownerUserId, created.draftId)
      : null;
    if (!result) throw new Error("article_draft_create_failed");
    return result;
  }

  async update(
    ownerUserId: string,
    draftId: string,
    boardId: number,
    input: ArticleDraftSaveRequest,
  ): Promise<ArticleDraftRecord | null> {
    const now = nowDate();
    const payload: DraftPayload = { ...input };
    delete payload.draftId;
    delete payload.expectedVersion;
    delete payload.fingerprint;
    delete payload.boardCode;

    const versionFilter =
      input.expectedVersion === undefined
        ? undefined
        : eq(articleDrafts.version, input.expectedVersion);

    const updated = await this.db
      .update(articleDrafts)
      .set({
        boardId,
        targetArticleId: input.targetArticleId
          ? Number(input.targetArticleId)
          : null,
        titleKo: input.titleKo,
        titleEn: input.titleEn ?? null,
        contentKo: input.contentKo,
        contentEn: input.contentEn ?? null,
        fingerprint: input.fingerprint,
        version: sql`${articleDrafts.version} + 1`,
        payload,
        updatedAt: now,
      })
      .where(
        and(
          eq(articleDrafts.ownerUserId, ownerUserId),
          eq(articleDrafts.draftId, draftId),
          versionFilter,
        ),
      )
      .returning({ draftId: articleDrafts.draftId });

    return updated[0]
      ? this.findById(ownerUserId, updated[0].draftId)
      : null;
  }

  async delete(ownerUserId: string, draftId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(articleDrafts)
      .where(
        and(
          eq(articleDrafts.ownerUserId, ownerUserId),
          eq(articleDrafts.draftId, draftId),
        ),
      )
      .returning({ draftId: articleDrafts.draftId });

    return deleted.length > 0;
  }
}
