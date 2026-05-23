import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, or, isNull } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { users, studentFeeStatus } from "../../infrastructure/postgres/postgres.schema";
import { BulkEmailRepository } from "./bulk-email.repository";
import type { BulkEmailRecord, SendBulkEmailRequest, SendBulkEmailResponse } from "@soc/contracts";

@Injectable()
export class BulkEmailService {
  private readonly logger = new Logger(BulkEmailService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    private readonly bulkEmailRepo: BulkEmailRepository,
  ) {}

  async getHistory(): Promise<BulkEmailRecord[]> {
    return this.bulkEmailRepo.findAll();
  }

  async sendBulkEmail(
    senderId: string,
    dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    // 1. Resolve recipients
    let queryWhere = eq(users.isActive, true);

    if (dto.recipientType === "PAID_STUDENTS") {
      queryWhere = and(
        eq(users.isActive, true),
        eq(studentFeeStatus.status, "PAID"),
      ) as any;
    } else if (dto.recipientType === "UNPAID_STUDENTS") {
      queryWhere = and(
        eq(users.isActive, true),
        or(
          eq(studentFeeStatus.status, "UNPAID"),
          isNull(studentFeeStatus.status),
        ),
      ) as any;
    }

    const recipients = await this.db
      .select({
        email: users.email,
        nameKo: users.nameKo,
      })
      .from(users)
      .leftJoin(studentFeeStatus, eq(users.userId, studentFeeStatus.userId))
      .where(queryWhere);

    const emails = recipients.map((r) => r.email).filter(Boolean);

    // 2. Perform Mock Dispatch
    this.logger.log(`========================================`);
    this.logger.log(`[BULK EMAIL DISPATCH]`);
    this.logger.log(`Subject: ${dto.subject}`);
    this.logger.log(`Recipient Type: ${dto.recipientType}`);
    this.logger.log(`Recipients Count: ${emails.length}`);
    this.logger.log(`Recipients List: ${emails.join(", ")}`);
    this.logger.log(`Content:\n${dto.content}`);
    this.logger.log(`========================================`);

    // 3. Log in Database
    const record = await this.bulkEmailRepo.insert({
      subject: dto.subject,
      content: dto.content,
      senderId,
      recipientCount: emails.length,
      status: "SUCCESS",
    });

    return {
      success: true,
      recipientCount: emails.length,
      emailId: record.id,
    };
  }
}
