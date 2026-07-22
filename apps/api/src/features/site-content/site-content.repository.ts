import { Inject, Injectable } from "@nestjs/common";
import type {
  SiteContentKey,
  SiteContentRecord,
  UpsertSiteContentRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";
import { asc, eq } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { siteContents } from "../../infrastructure/postgres/postgres.schema";

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
}
