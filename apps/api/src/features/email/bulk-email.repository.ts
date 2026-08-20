import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { bulkEmails, users } from "../../infrastructure/postgres/postgres.schema";
import type { BulkEmailRecord } from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

@Injectable()
export class BulkEmailRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async findAll(): Promise<BulkEmailRecord[]> {
    const rows = await this.db
      .select({
        id: bulkEmails.id,
        subject: bulkEmails.subject,
        content: bulkEmails.content,
        senderId: bulkEmails.senderId,
        senderNameKo: users.nameKo,
        senderNameEn: users.nameEn,
        recipientCount: bulkEmails.recipientCount,
        status: bulkEmails.status,
        sentAt: bulkEmails.sentAt,
      })
      .from(bulkEmails)
      .leftJoin(users, eq(bulkEmails.senderId, users.userId))
      .orderBy(desc(bulkEmails.sentAt));

    return rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      content: r.content,
      senderId: r.senderId,
      senderName: r.senderNameKo ?? "Unknown",
      recipientCount: r.recipientCount,
      status: r.status,
      sentAt: msToIso(r.sentAt.valueOf()),
    }));
  }

  async create(input: {
    subject: string;
    content: string;
    senderId: string;
    recipientCount: number;
    status: string;
  }): Promise<string> {
    const [row] = await this.db
      .insert(bulkEmails)
      .values({
        subject: input.subject,
        content: input.content,
        senderId: input.senderId,
        recipientCount: input.recipientCount,
        status: input.status,
        sentAt: nowDate(),
      })
      .returning({ id: bulkEmails.id });

    if (!row) throw new Error("bulk_email_record_create_failed");
    return row.id;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(bulkEmails)
      .set({ status })
      .where(eq(bulkEmails.id, id));
  }

}
