import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lte } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { bulkEmails, users } from "../../infrastructure/postgres/postgres.schema";
import type {
  BulkEmailRecord,
  BulkEmailStatus,
  SaveBulkEmailDraftRequest,
  SendBulkEmailRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

type RecipientType = SendBulkEmailRequest["recipientType"];
type ContentType = SendBulkEmailRequest["contentType"];
type RecipientFilters = NonNullable<SendBulkEmailRequest["filters"]>;

export interface BulkEmailStoredRecord extends BulkEmailRecord {
  recipientFilters: RecipientFilters;
  attachmentAssetIds: string[];
  errorMessage: string | null;
  completedAt: string | null;
  idempotencyKey: string | null;
}

type EmailRow = {
  id: string;
  subject: string;
  content: string;
  contentType: string;
  recipientType: string;
  recipientFilters: unknown;
  attachmentAssetIds: unknown;
  senderId: string | null;
  senderNameKo: string | null;
  recipientCount: number;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
  errorMessage: string | null;
  idempotencyKey: string | null;
};

const isRecipientType = (value: string): value is RecipientType =>
  value === "ALL" || value === "PAID_STUDENTS" || value === "UNPAID_STUDENTS";

const isContentType = (value: string): value is ContentType =>
  value === "plain" || value === "html";

const isBulkEmailStatus = (value: string): value is BulkEmailStatus =>
  value === "DRAFT" ||
  value === "SCHEDULED" ||
  value === "PENDING" ||
  value === "SUCCESS" ||
  value === "DRY_RUN" ||
  value === "FAILED" ||
  value === "CANCELLED";

const normalizeFilters = (value: unknown): RecipientFilters => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => typeof item === "string" && item.trim().length > 0,
    ),
  ) as RecipientFilters;
};

const normalizeAssetIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && /^\d+$/.test(item))
    : [];

@Injectable()
export class BulkEmailRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private selectColumns() {
    return {
      id: bulkEmails.id,
      subject: bulkEmails.subject,
      content: bulkEmails.content,
      contentType: bulkEmails.contentType,
      recipientType: bulkEmails.recipientType,
      recipientFilters: bulkEmails.recipientFilters,
      attachmentAssetIds: bulkEmails.attachmentAssetIds,
      senderId: bulkEmails.senderId,
      senderNameKo: users.nameKo,
      recipientCount: bulkEmails.recipientCount,
      status: bulkEmails.status,
      scheduledAt: bulkEmails.scheduledAt,
      sentAt: bulkEmails.sentAt,
      completedAt: bulkEmails.completedAt,
      updatedAt: bulkEmails.updatedAt,
      errorMessage: bulkEmails.errorMessage,
      idempotencyKey: bulkEmails.idempotencyKey,
    };
  }

  private mapRow(row: EmailRow): BulkEmailStoredRecord {
    return {
      id: row.id,
      subject: row.subject,
      content: row.content,
      contentType: isContentType(row.contentType) ? row.contentType : "html",
      recipientType: isRecipientType(row.recipientType) ? row.recipientType : "ALL",
      filters: normalizeFilters(row.recipientFilters),
      attachmentCount: normalizeAssetIds(row.attachmentAssetIds).length,
      senderId: row.senderId,
      senderName: row.senderNameKo ?? "Unknown",
      recipientCount: row.recipientCount,
      status: isBulkEmailStatus(row.status) ? row.status : "FAILED",
      scheduledAt: row.scheduledAt ? msToIso(row.scheduledAt.valueOf()) : null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      sentAt: msToIso(row.sentAt.valueOf()),
      recipientFilters: normalizeFilters(row.recipientFilters),
      attachmentAssetIds: normalizeAssetIds(row.attachmentAssetIds),
      errorMessage: row.errorMessage,
      completedAt: row.completedAt ? msToIso(row.completedAt.valueOf()) : null,
      idempotencyKey: row.idempotencyKey,
    };
  }

  private async findRows(where?: unknown): Promise<BulkEmailStoredRecord[]> {
    const query = this.db
      .select(this.selectColumns())
      .from(bulkEmails)
      .leftJoin(users, eq(bulkEmails.senderId, users.userId));

    const rows = await (where
      ? query.where(where as never)
      : query
    ).orderBy(desc(bulkEmails.updatedAt), desc(bulkEmails.sentAt));

    return rows.map((row) => this.mapRow(row as EmailRow));
  }

  async findAll(): Promise<BulkEmailRecord[]> {
    return this.findRows();
  }

  async findById(id: string): Promise<BulkEmailStoredRecord | null> {
    const rows = await this.findRows(eq(bulkEmails.id, id));
    return rows[0] ?? null;
  }

  async findByIdempotencyKey(
    senderId: string,
    idempotencyKey: string,
  ): Promise<BulkEmailStoredRecord | null> {
    const rows = await this.findRows(
      and(
        eq(bulkEmails.senderId, senderId),
        eq(bulkEmails.idempotencyKey, idempotencyKey),
      ),
    );
    return rows[0] ?? null;
  }

  async findDrafts(senderId: string): Promise<BulkEmailStoredRecord[]> {
    return this.findRows(
      and(eq(bulkEmails.senderId, senderId), eq(bulkEmails.status, "DRAFT")),
    );
  }

  async create(input: {
    subject: string;
    content: string;
    contentType: ContentType;
    recipientType: RecipientType;
    recipientFilters?: RecipientFilters;
    attachmentAssetIds?: string[];
    senderId: string;
    recipientCount: number;
    status: BulkEmailStatus;
    scheduledAt?: Date | null;
    idempotencyKey?: string | null;
  }): Promise<string> {
    const now = nowDate();
    const [row] = await this.db
      .insert(bulkEmails)
      .values({
        subject: input.subject,
        content: input.content,
        contentType: input.contentType,
        recipientType: input.recipientType,
        recipientFilters: input.recipientFilters ?? null,
        attachmentAssetIds: input.attachmentAssetIds ?? [],
        senderId: input.senderId,
        recipientCount: input.recipientCount,
        status: input.status,
        scheduledAt: input.scheduledAt ?? null,
        sentAt: now,
        updatedAt: now,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning({ id: bulkEmails.id });

    if (!row) throw new Error("bulk_email_record_create_failed");
    return row.id;
  }

  async saveDraft(
    senderId: string,
    input: SaveBulkEmailDraftRequest,
  ): Promise<BulkEmailStoredRecord | null> {
    const now = nowDate();
    const values = {
      subject: input.subject,
      content: input.content,
      contentType: input.contentType,
      recipientType: input.recipientType,
      recipientFilters: input.filters ?? null,
      attachmentAssetIds: input.attachmentAssetIds,
      recipientCount: 0,
      status: "DRAFT" as const,
      scheduledAt: null,
      completedAt: null,
      errorMessage: null,
      updatedAt: now,
    };

    if (input.draftId) {
      const updated = await this.db
        .update(bulkEmails)
        .set(values)
        .where(
          and(
            eq(bulkEmails.id, input.draftId),
            eq(bulkEmails.senderId, senderId),
            eq(bulkEmails.status, "DRAFT"),
          ),
        )
        .returning({ id: bulkEmails.id });

      if (updated.length === 0) return null;
      return this.findById(updated[0].id);
    }

    const [created] = await this.db
      .insert(bulkEmails)
      .values({
        ...values,
        senderId,
        sentAt: now,
      })
      .returning({ id: bulkEmails.id });

    return created ? this.findById(created.id) : null;
  }

  async deleteDraft(senderId: string, draftId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(bulkEmails)
      .where(
        and(
          eq(bulkEmails.id, draftId),
          eq(bulkEmails.senderId, senderId),
          eq(bulkEmails.status, "DRAFT"),
        ),
      )
      .returning({ id: bulkEmails.id });

    return deleted.length > 0;
  }

  async claimScheduled(
    id: string,
    now: Date,
  ): Promise<BulkEmailStoredRecord | null> {
    const claimed = await this.db
      .update(bulkEmails)
      .set({ status: "PENDING", updatedAt: now, errorMessage: null })
      .where(
        and(
          eq(bulkEmails.id, id),
          eq(bulkEmails.status, "SCHEDULED"),
          lte(bulkEmails.scheduledAt, now),
        ),
      )
      .returning({ id: bulkEmails.id });

    return claimed[0] ? this.findById(claimed[0].id) : null;
  }

  async cancelScheduled(senderId: string, id: string): Promise<boolean> {
    const updated = await this.db
      .update(bulkEmails)
      .set({ status: "CANCELLED", updatedAt: nowDate(), completedAt: nowDate() })
      .where(
        and(
          eq(bulkEmails.id, id),
          eq(bulkEmails.senderId, senderId),
          eq(bulkEmails.status, "SCHEDULED"),
        ),
      )
      .returning({ id: bulkEmails.id });
    return updated.length > 0;
  }

  async claimFailedForRetry(senderId: string, id: string): Promise<BulkEmailStoredRecord | null> {
    const updated = await this.db
      .update(bulkEmails)
      .set({ status: "PENDING", updatedAt: nowDate(), completedAt: null, errorMessage: null })
      .where(
        and(
          eq(bulkEmails.id, id),
          eq(bulkEmails.senderId, senderId),
          eq(bulkEmails.status, "FAILED"),
        ),
      )
      .returning({ id: bulkEmails.id });
    return updated[0] ? this.findById(updated[0].id) : null;
  }

  async findDueScheduled(now: Date, limit = 20): Promise<string[]> {
    const rows = await this.db
      .select({ id: bulkEmails.id })
      .from(bulkEmails)
      .where(
        and(
          eq(bulkEmails.status, "SCHEDULED"),
          lte(bulkEmails.scheduledAt, now),
        ),
      )
      .orderBy(bulkEmails.scheduledAt)
      .limit(limit);

    return rows.map((row) => row.id);
  }

  async updateStatus(
    id: string,
    status: BulkEmailStatus,
    errorMessage?: string | null,
  ): Promise<void> {
    const now = nowDate();
    const terminal = status === "SUCCESS" || status === "DRY_RUN" || status === "FAILED";
    await this.db
      .update(bulkEmails)
      .set({
        status,
        updatedAt: now,
        completedAt: terminal ? now : null,
        errorMessage: errorMessage ?? null,
      })
      .where(eq(bulkEmails.id, id));
  }
}
