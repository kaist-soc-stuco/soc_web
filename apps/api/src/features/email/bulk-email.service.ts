import { Injectable, NotImplementedException } from "@nestjs/common";
import { BulkEmailRepository } from "./bulk-email.repository";
import type { BulkEmailRecord, SendBulkEmailRequest, SendBulkEmailResponse } from "@soc/contracts";

export const BULK_EMAIL_DELIVERY_NOT_CONFIGURED =
  "bulk_email_delivery_not_configured";

@Injectable()
export class BulkEmailService {
  constructor(
    private readonly bulkEmailRepo: BulkEmailRepository,
  ) {}

  async getHistory(): Promise<BulkEmailRecord[]> {
    return this.bulkEmailRepo.findAll();
  }

  async sendBulkEmail(
    _senderId: string,
    _dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
  }
}
