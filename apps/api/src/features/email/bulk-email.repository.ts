import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { bulkEmails, users } from "../../infrastructure/postgres/postgres.schema";
import type { BulkEmailRecord } from "@soc/contracts";
import { msToIso } from "@soc/shared";

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

}
