import { Injectable, Logger } from "@nestjs/common";
import { BulkEmailRepository } from "./bulk-email.repository";
import type { BulkEmailRecord, SendBulkEmailRequest, SendBulkEmailResponse } from "@soc/contracts";

@Injectable()
export class BulkEmailService {
  private readonly logger = new Logger(BulkEmailService.name);

  constructor(
    private readonly bulkEmailRepo: BulkEmailRepository,
  ) {}

  async getHistory(): Promise<BulkEmailRecord[]> {
    return this.bulkEmailRepo.findAll();
  }

  async sendBulkEmail(
    senderId: string,
    dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    const emails = await this.bulkEmailRepo.findRecipientEmails(dto.recipientType);

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
