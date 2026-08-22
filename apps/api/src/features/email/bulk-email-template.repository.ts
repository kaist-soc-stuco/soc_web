import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";

import type {
  BulkEmailTemplate,
  CreateBulkEmailTemplateRequest,
  UpdateBulkEmailTemplateRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { bulkEmailTemplates } from "../../infrastructure/postgres/postgres.schema";

type TemplateRow = typeof bulkEmailTemplates.$inferSelect;

type TemplateStoredRecord = BulkEmailTemplate;

const isContentType = (value: string): value is BulkEmailTemplate["contentType"] =>
  value === "plain" || value === "html";

const isRecipientType = (
  value: string,
): value is BulkEmailTemplate["recipientType"] =>
  value === "ALL" || value === "PAID_STUDENTS" || value === "UNPAID_STUDENTS";

const normalizeFilters = (value: unknown): BulkEmailTemplate["filters"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => typeof item === "string" && item.trim().length > 0,
    ),
  ) as BulkEmailTemplate["filters"];
};

@Injectable()
export class BulkEmailTemplateRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: TemplateRow): TemplateStoredRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      subject: row.subject,
      content: row.content,
      contentType: isContentType(row.contentType) ? row.contentType : "html",
      recipientType: isRecipientType(row.recipientType) ? row.recipientType : "ALL",
      filters: normalizeFilters(row.recipientFilters),
      createdBy: row.createdBy,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findAll(): Promise<TemplateStoredRecord[]> {
    const rows = await this.db
      .select()
      .from(bulkEmailTemplates)
      .orderBy(desc(bulkEmailTemplates.updatedAt));
    return rows.map((row) => this.map(row));
  }

  async findById(id: string): Promise<TemplateStoredRecord | null> {
    const row = await this.db.query.bulkEmailTemplates.findFirst({
      where: eq(bulkEmailTemplates.id, id),
    });
    return row ? this.map(row) : null;
  }

  async create(
    creatorId: string,
    input: CreateBulkEmailTemplateRequest,
  ): Promise<TemplateStoredRecord> {
    const now = nowDate();
    const [row] = await this.db
      .insert(bulkEmailTemplates)
      .values({
        name: input.name,
        description: input.description ?? "",
        subject: input.subject,
        content: input.content,
        contentType: input.contentType,
        recipientType: input.recipientType,
        recipientFilters: input.filters ?? null,
        createdBy: creatorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) throw new Error("bulk_email_template_create_failed");
    return this.map(row);
  }

  async update(
    id: string,
    input: UpdateBulkEmailTemplateRequest,
  ): Promise<TemplateStoredRecord | null> {
    const values: Partial<typeof bulkEmailTemplates.$inferInsert> & {
      updatedAt: Date;
    } = { updatedAt: nowDate() };

    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.subject !== undefined) values.subject = input.subject;
    if (input.content !== undefined) values.content = input.content;
    if (input.contentType !== undefined) values.contentType = input.contentType;
    if (input.recipientType !== undefined) values.recipientType = input.recipientType;
    if (input.filters !== undefined) values.recipientFilters = input.filters;

    const [row] = await this.db
      .update(bulkEmailTemplates)
      .set(values)
      .where(eq(bulkEmailTemplates.id, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(bulkEmailTemplates)
      .where(eq(bulkEmailTemplates.id, id))
      .returning({ id: bulkEmailTemplates.id });
    return rows.length > 0;
  }
}
