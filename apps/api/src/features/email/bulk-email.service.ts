import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from "@nestjs/common";
import { BulkEmailRepository } from "./bulk-email.repository";
import { EmailDeliveryService } from "./email-delivery.service";
import type {
  BulkEmailRecord,
  BulkEmailTemplate,
  SendBulkEmailRequest,
  SendBulkEmailResponse,
} from "@soc/contracts";
import { UsersService } from "../users/users.service";

export const BULK_EMAIL_DELIVERY_NOT_CONFIGURED =
  "bulk_email_delivery_not_configured";

const BULK_EMAIL_TEMPLATES: BulkEmailTemplate[] = [
  {
    id: "f26-unpaid-reminder",
    name: "F26 과비 미납 안내",
    description: "F26 미납자 그룹에 학생회비 납부 안내를 보냅니다.",
    subject: "[전산학부 학생회] F26 학생회비 납부 안내",
    content: [
      "안녕하세요, 전산학부 학생회입니다.",
      "",
      "현재 학생회비 납부 내역이 확인되지 않아 안내드립니다.",
      "납부 여부 또는 금액에 변동이 있다면 학생회로 회신해 주세요.",
      "",
      "감사합니다.",
      "전산학부 학생회 드림",
    ].join("\n"),
    recipientType: "UNPAID_STUDENTS",
  },
  {
    id: "general-notice",
    name: "일반 공지",
    description: "전체 학생에게 보낼 기본 공지 메일 양식입니다.",
    subject: "[전산학부 학생회] 안내드립니다",
    content: [
      "안녕하세요, 전산학부 학생회입니다.",
      "",
      "안내 내용을 입력해 주세요.",
      "",
      "감사합니다.",
      "전산학부 학생회 드림",
    ].join("\n"),
    recipientType: "ALL",
  },
];

@Injectable()
export class BulkEmailService {
  private readonly logger = new Logger(BulkEmailService.name);

  constructor(
    private readonly bulkEmailRepo: BulkEmailRepository,
    private readonly usersService: UsersService,
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {}

  async getHistory(): Promise<BulkEmailRecord[]> {
    return this.bulkEmailRepo.findAll();
  }

  getTemplates(): BulkEmailTemplate[] {
    return BULK_EMAIL_TEMPLATES;
  }

  async sendBulkEmail(
    senderId: string,
    dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    // Keeps manually constructed legacy service tests fail-closed while the
    // Nest container always supplies both collaborators in the real module.
    if (!this.usersService || !this.emailDeliveryService) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const recipients = await this.usersService.listEmailRecipients(dto.recipientType);
    if (recipients.length === 0) {
      throw new BadRequestException("bulk_email_no_recipients");
    }

    const emailId = await this.bulkEmailRepo.create({
      subject: dto.subject,
      content: dto.content,
      recipientCount: recipients.length,
      senderId,
      status: "PENDING",
    });

    try {
      const delivery = await this.emailDeliveryService.send({
        recipients: recipients.map((recipient) => recipient.email),
        subject: dto.subject,
        content: dto.content,
      });
      await this.bulkEmailRepo.updateStatus(emailId, delivery.dryRun ? "DRY_RUN" : "SUCCESS");

      return {
        success: true,
        recipientCount: recipients.length,
        emailId,
        deliveryMode: delivery.dryRun ? "dry_run" : "sent",
      };
    } catch (error) {
      await this.bulkEmailRepo.updateStatus(emailId, "FAILED");
      this.logger.error(`Bulk email delivery failed for ${emailId}`, error);
      throw error;
    }
  }
}
