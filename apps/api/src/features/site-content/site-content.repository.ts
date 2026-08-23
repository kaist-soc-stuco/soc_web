import { Inject, Injectable } from "@nestjs/common";
import type {
  ContentBlockRecord,
  CreateContentBlockRequest,
  ReorderContentBlocksRequest,
  SiteContentKey,
  SiteContentRecord,
  UpdateContentBlockRequest,
  UpsertSiteContentRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";
import { asc, desc, eq } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { contentBlocks, siteContents } from "../../infrastructure/postgres/postgres.schema";

@Injectable()
export class SiteContentRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof siteContents.$inferSelect): SiteContentRecord {
    return {
      createdAt: msToIso(row.createdAt.valueOf()),
      key: row.key,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      updatedBy: row.updatedBy ?? null,
      valueEn: row.valueEn,
      valueKo: row.valueKo,
    };
  }

  private mapBlock(row: typeof contentBlocks.$inferSelect): ContentBlockRecord {
    return {
      bodyEn: row.bodyEn,
      bodyKo: row.bodyKo,
      contentBlockId: row.contentBlockId,
      createdAt: msToIso(row.createdAt.valueOf()),
      createdBy: row.createdBy,
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl,
      pledgeStatus: row.pledgeStatus as ContentBlockRecord["pledgeStatus"],
      publishedAt: row.publishedAt ? msToIso(row.publishedAt.valueOf()) : null,
      publishedBy: row.publishedBy,
      sortOrder: row.sortOrder,
      status: row.status,
      titleEn: row.titleEn,
      titleKo: row.titleKo,
      type: row.type,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      updatedBy: row.updatedBy,
    };
  }

  async findAll(): Promise<SiteContentRecord[]> {
    const rows = await this.db
      .select()
      .from(siteContents)
      .orderBy(asc(siteContents.key));

    return rows.map((row) => this.map(row));
  }

  async findByKey(key: SiteContentKey): Promise<SiteContentRecord | null> {
    const [row] = await this.db
      .select()
      .from(siteContents)
      .where(eq(siteContents.key, key));

    return row ? this.map(row) : null;
  }

  async upsert(
    key: SiteContentKey,
    input: UpsertSiteContentRequest,
    updatedBy: string,
  ): Promise<SiteContentRecord> {
    const updatedAt = nowDate();
    const [row] = await this.db
      .insert(siteContents)
      .values({
        key,
        updatedAt,
        updatedBy,
        valueEn: input.valueEn,
        valueKo: input.valueKo,
      })
      .onConflictDoUpdate({
        set: {
          updatedAt,
          updatedBy,
          valueEn: input.valueEn,
          valueKo: input.valueKo,
        },
        target: siteContents.key,
      })
      .returning();

    return this.map(row);
  }

  async delete(key: SiteContentKey): Promise<SiteContentRecord | null> {
    const [row] = await this.db
      .delete(siteContents)
      .where(eq(siteContents.key, key))
      .returning();

    return row ? this.map(row) : null;
  }

  async listContentBlocks(): Promise<ContentBlockRecord[]> {
    const rows = await this.db
      .select()
      .from(contentBlocks)
      .orderBy(asc(contentBlocks.sortOrder), desc(contentBlocks.updatedAt));
    return rows.map((row) => this.mapBlock(row));
  }

  async findContentBlockById(contentBlockId: string): Promise<ContentBlockRecord | null> {
    const [row] = await this.db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.contentBlockId, contentBlockId));
    return row ? this.mapBlock(row) : null;
  }

  async createContentBlock(input: CreateContentBlockRequest, actorUserId: string): Promise<ContentBlockRecord> {
    const [row] = await this.db
      .insert(contentBlocks)
      .values({
        ...input,
        bodyEn: input.bodyEn ?? null,
        bodyKo: input.bodyKo ?? null,
        createdBy: actorUserId,
        imageUrl: input.imageUrl ?? null,
        linkUrl: input.linkUrl ?? null,
        pledgeStatus: input.pledgeStatus ?? null,
        updatedBy: actorUserId,
      })
      .returning();
    return this.mapBlock(row);
  }

  async updateContentBlock(
    contentBlockId: string,
    input: UpdateContentBlockRequest,
    actorUserId: string,
  ): Promise<ContentBlockRecord | null> {
    const values: Partial<typeof contentBlocks.$inferInsert> = {
      updatedAt: nowDate(),
      updatedBy: actorUserId,
    };
    if (input.type !== undefined) values.type = input.type;
    if (input.titleKo !== undefined) values.titleKo = input.titleKo;
    if (input.titleEn !== undefined) values.titleEn = input.titleEn;
    if (input.bodyKo !== undefined) values.bodyKo = input.bodyKo;
    if (input.bodyEn !== undefined) values.bodyEn = input.bodyEn;
    if (input.linkUrl !== undefined) values.linkUrl = input.linkUrl;
    if (input.imageUrl !== undefined) values.imageUrl = input.imageUrl;
    if (input.pledgeStatus !== undefined) values.pledgeStatus = input.pledgeStatus;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    const [row] = await this.db
      .update(contentBlocks)
      .set(values)
      .where(eq(contentBlocks.contentBlockId, contentBlockId))
      .returning();
    return row ? this.mapBlock(row) : null;
  }

  async reorderContentBlocks(
    items: ReorderContentBlocksRequest["items"],
    actorUserId: string,
  ): Promise<ContentBlockRecord[]> {
    return this.db.transaction(async (tx) => {
      const updatedAt = nowDate();
      for (const item of items) {
        await tx
          .update(contentBlocks)
          .set({ sortOrder: item.sortOrder, updatedAt, updatedBy: actorUserId })
          .where(eq(contentBlocks.contentBlockId, item.contentBlockId));
      }
      const rows = await tx
        .select()
        .from(contentBlocks)
        .orderBy(asc(contentBlocks.sortOrder), desc(contentBlocks.updatedAt));
      return rows.map((row) => this.mapBlock(row));
    });
  }

  async setContentBlockStatus(
    contentBlockId: string,
    status: ContentBlockRecord["status"],
    actorUserId: string,
  ): Promise<ContentBlockRecord | null> {
    const now = nowDate();
    const [row] = await this.db
      .update(contentBlocks)
      .set({
        publishedAt: status === "PUBLISHED" ? now : undefined,
        publishedBy: status === "PUBLISHED" ? actorUserId : undefined,
        status,
        updatedAt: now,
        updatedBy: actorUserId,
      })
      .where(eq(contentBlocks.contentBlockId, contentBlockId))
      .returning();
    return row ? this.mapBlock(row) : null;
  }

  async deleteContentBlock(contentBlockId: string): Promise<ContentBlockRecord | null> {
    const [row] = await this.db
      .delete(contentBlocks)
      .where(eq(contentBlocks.contentBlockId, contentBlockId))
      .returning();
    return row ? this.mapBlock(row) : null;
  }
}
