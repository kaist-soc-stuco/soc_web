import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BulkEmailRepository, type BulkEmailStoredRecord } from "./bulk-email.repository";
import { BulkEmailTemplateRepository } from "./bulk-email-template.repository";
import { EmailDeliveryService } from "./email-delivery.service";
import { AssetService } from "../asset/asset.service";
import type {
  BulkEmailDraftListResponse,
  BulkEmailPreviewResponse,
  BulkEmailRecord,
  BulkEmailTemplate,
  SaveBulkEmailDraftRequest,
  CreateBulkEmailTemplateRequest,
  SendBulkEmailRequest,
  SendBulkEmailResponse,
  SendBulkEmailTestResponse,
  UpdateBulkEmailTemplateRequest,
} from "@soc/contracts";
import { UsersService } from "../users/users.service";
import sanitizeHtml from "sanitize-html";
import { isoToDate, nowDate, nowMs } from "@soc/shared";

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
    contentType: "plain",
    recipientType: "UNPAID_STUDENTS",
    filters: {},
    createdBy: null,
    updatedAt: "2026-08-20T00:00:00.000Z",
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
    contentType: "plain",
    recipientType: "ALL",
    filters: {},
    createdBy: null,
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
];

type DeliveryAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type EmailCompose = {
  subject: string;
  content: string;
  contentType: SendBulkEmailRequest["contentType"];
  recipientType: SendBulkEmailRequest["recipientType"];
  filters: SendBulkEmailRequest["filters"];
  attachmentAssetIds: string[];
};

@Injectable()
export class BulkEmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BulkEmailService.name);
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private scheduledRunInProgress = false;

  constructor(
    private readonly bulkEmailRepo: BulkEmailRepository,
    private readonly usersService: UsersService,
    private readonly emailDeliveryService: EmailDeliveryService,
    private readonly configService: ConfigService,
    private readonly assetService: AssetService,
    private readonly templateRepo?: BulkEmailTemplateRepository,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get<boolean>(
      "BULK_EMAIL_SCHEDULER_ENABLED",
      true,
    );
    if (!enabled) {
      this.logger.log("Bulk email scheduler is disabled.");
      return;
    }

    const intervalMs = Math.max(
      1_000,
      this.configService.get<number>("BULK_EMAIL_SCHEDULER_INTERVAL_MS", 30_000),
    );
    this.schedulerInterval = setInterval(() => {
      void this.processScheduledEmails();
    }, intervalMs);
    this.logger.log(`Bulk email scheduler started; interval=${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  async getHistory(): Promise<BulkEmailRecord[]> {
    const records = await this.bulkEmailRepo.findAll();
    return records.filter((record) =>
      record.status === "SUCCESS" ||
      record.status === "SCHEDULED" ||
      record.status === "DRY_RUN",
    );
  }

  async getDrafts(senderId: string): Promise<BulkEmailDraftListResponse> {
    return { items: await this.bulkEmailRepo.findDrafts(senderId) };
  }

  async getTemplates(): Promise<BulkEmailTemplate[]> {
    if (!this.templateRepo) return BULK_EMAIL_TEMPLATES;
    const custom = await this.templateRepo.findAll();
    return [...custom, ...BULK_EMAIL_TEMPLATES];
  }

  async createTemplate(
    creatorId: string,
    dto: CreateBulkEmailTemplateRequest,
  ): Promise<BulkEmailTemplate> {
    if (!this.templateRepo) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }
    return this.templateRepo.create(creatorId, dto);
  }

  async updateTemplate(
    id: string,
    dto: UpdateBulkEmailTemplateRequest,
  ): Promise<BulkEmailTemplate> {
    if (!this.templateRepo) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }
    const updated = await this.templateRepo.update(id, dto);
    if (!updated) throw new NotFoundException("bulk_email_template_not_found");
    return updated;
  }

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    if (!this.templateRepo) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }
    const deleted = await this.templateRepo.delete(id);
    if (!deleted) throw new NotFoundException("bulk_email_template_not_found");
    return { success: true };
  }

  async previewRecipients(
    dto: SendBulkEmailRequest,
  ): Promise<BulkEmailPreviewResponse> {
    const recipients = await this.usersService.listEmailRecipients(dto.recipientType, dto.filters);
    return { recipientCount: recipients.length, sample: recipients.slice(0, 10) };
  }

  async saveDraft(
    senderId: string,
    dto: SaveBulkEmailDraftRequest,
  ): Promise<BulkEmailRecord> {
    if (!this.usersService || !this.emailDeliveryService || !this.assetService) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    await this.loadAttachments(senderId, dto.attachmentAssetIds ?? []);
    const saved = await this.bulkEmailRepo.saveDraft(senderId, dto);
    if (!saved) {
      throw new NotFoundException("bulk_email_draft_not_found");
    }
    return saved;
  }

  async deleteDraft(senderId: string, draftId: string): Promise<{ success: boolean }> {
    const deleted = await this.bulkEmailRepo.deleteDraft(senderId, draftId);
    if (!deleted) {
      throw new NotFoundException("bulk_email_draft_not_found");
    }
    return { success: true };
  }

  async sendBulkEmail(
    senderId: string,
    dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    // Keeps manually constructed legacy service tests fail-closed while the
    // Nest container always supplies all collaborators in the real module.
    if (!this.usersService || !this.emailDeliveryService || !this.assetService) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const recipientType = dto.recipientType;
    const filters = dto.filters;
    const attachmentAssetIds = dto.attachmentAssetIds ?? [];
    const idempotencyKey = dto.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = await this.bulkEmailRepo.findByIdempotencyKey(
        senderId,
        idempotencyKey,
      );
      if (existing) return responseForExistingRecord(existing);
    }
    const recipients = await this.usersService.listEmailRecipients(recipientType, filters);
    if (recipients.length === 0) {
      throw new BadRequestException("bulk_email_no_recipients");
    }

    const scheduledAt = parseScheduledAt(dto.scheduledAt);
    await this.loadAttachments(senderId, attachmentAssetIds);

    const emailId = await this.bulkEmailRepo.create({
      subject: dto.subject,
      content: dto.content,
      contentType: dto.contentType ?? "html",
      recipientType,
      recipientFilters: filters,
      attachmentAssetIds,
      recipientCount: recipients.length,
      senderId,
      status: scheduledAt ? "SCHEDULED" : "PENDING",
      scheduledAt,
      idempotencyKey,
    });

    if (scheduledAt) {
      return {
        success: true,
        recipientCount: recipients.length,
        emailId,
        deliveryMode: "scheduled",
      };
    }

    try {
      const delivery = await this.deliver({
        emailId,
        senderId,
        recipients: recipients.map((recipient) => recipient.email),
        compose: {
          subject: dto.subject,
          content: dto.content,
          contentType: dto.contentType ?? "html",
          recipientType,
          filters,
          attachmentAssetIds,
        },
      });

      return {
        success: true,
        recipientCount: recipients.length,
        emailId,
        deliveryMode: delivery.dryRun ? "dry_run" : "sent",
      };
    } catch (error) {
      await this.markFailed(emailId, error);
      this.logger.error(`Bulk email delivery failed for ${emailId}`, error);
      throw error;
    }
  }

  async sendTestEmail(
    senderId: string,
    dto: SendBulkEmailRequest,
  ): Promise<SendBulkEmailTestResponse> {
    if (!this.usersService || !this.emailDeliveryService || !this.assetService) {
      throw new NotImplementedException(BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const sender = await this.usersService.findById(senderId);
    const recipientEmail = sender?.email?.trim();
    if (!recipientEmail) {
      throw new BadRequestException("bulk_email_test_recipient_missing");
    }

    const attachments = await this.loadAttachments(senderId, dto.attachmentAssetIds ?? []);
    const delivery = await this.emailDeliveryService.send({
      recipients: [recipientEmail],
      subject: `[테스트] ${dto.subject}`,
      content:
        dto.contentType === "html" ? stripHtml(dto.content) : dto.content,
      ...(dto.contentType === "html" ? { html: sanitizeHtml(dto.content) } : {}),
      ...(attachments.length ? { attachments } : {}),
    });

    return {
      success: true,
      recipientEmail,
      deliveryMode: delivery.dryRun ? "dry_run" : "sent",
    };
  }

  async processScheduledEmails(): Promise<void> {
    if (this.scheduledRunInProgress) return;
    this.scheduledRunInProgress = true;

    try {
      const dueIds = await this.bulkEmailRepo.findDueScheduled(nowDate(), 20);
      for (const dueId of dueIds) {
        const record = await this.bulkEmailRepo.claimScheduled(dueId, nowDate());
        if (!record) continue;

        try {
          await this.deliverStored(record);
        } catch (error) {
          await this.markFailed(record.id, error);
          this.logger.error(`Scheduled bulk email failed for ${record.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error(
        "Scheduled bulk email polling failed.",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.scheduledRunInProgress = false;
    }
  }

  async cancelScheduled(senderId: string, emailId: string): Promise<BulkEmailRecord> {
    const cancelled = await this.bulkEmailRepo.cancelScheduled(senderId, emailId);
    if (!cancelled) {
      throw new ConflictException("bulk_email_not_scheduled_or_not_owned");
    }
    const record = await this.bulkEmailRepo.findById(emailId);
    if (!record) throw new NotFoundException("bulk_email_not_found");
    return record;
  }

  async retryFailed(senderId: string, emailId: string): Promise<SendBulkEmailResponse> {
    const record = await this.bulkEmailRepo.claimFailedForRetry(senderId, emailId);
    if (!record) {
      throw new ConflictException("bulk_email_not_failed_or_not_owned");
    }

    const recipients = await this.usersService.listEmailRecipients(
      record.recipientType,
      record.recipientFilters,
    );
    if (recipients.length === 0) {
      const error = new BadRequestException("bulk_email_no_recipients");
      await this.markFailed(record.id, error);
      throw error;
    }

    try {
      const delivery = await this.deliver({
        emailId: record.id,
        senderId,
        recipients: recipients.map((recipient) => recipient.email),
        compose: {
          subject: record.subject,
          content: record.content,
          contentType: record.contentType,
          recipientType: record.recipientType,
          filters: record.recipientFilters,
          attachmentAssetIds: record.attachmentAssetIds,
        },
      });
      return {
        success: true,
        recipientCount: recipients.length,
        emailId: record.id,
        deliveryMode: delivery.dryRun ? "dry_run" : "sent",
      };
    } catch (error) {
      await this.markFailed(record.id, error);
      throw error;
    }
  }

  private async deliverStored(record: BulkEmailStoredRecord): Promise<void> {
    if (!record.senderId) throw new BadRequestException("bulk_email_sender_missing");
    const recipients = await this.usersService.listEmailRecipients(
      record.recipientType,
      record.recipientFilters,
    );
    if (recipients.length === 0) {
      throw new BadRequestException("bulk_email_no_recipients");
    }

    await this.deliver({
      emailId: record.id,
      senderId: record.senderId,
      recipients: recipients.map((recipient) => recipient.email),
      compose: {
        subject: record.subject,
        content: record.content,
        contentType: record.contentType,
        recipientType: record.recipientType,
        filters: record.recipientFilters,
        attachmentAssetIds: record.attachmentAssetIds,
      },
    });
  }

  private async deliver(input: {
    emailId: string;
    senderId: string;
    recipients: string[];
    compose: EmailCompose;
  }): Promise<{ dryRun: boolean }> {
    const attachments = await this.loadAttachments(
      input.senderId,
      input.compose.attachmentAssetIds,
    );
    const delivery = await this.emailDeliveryService.send({
      recipients: input.recipients,
      subject: input.compose.subject,
      content:
        input.compose.contentType === "html"
          ? stripHtml(input.compose.content)
          : input.compose.content,
      ...(input.compose.contentType === "html"
        ? { html: sanitizeHtml(input.compose.content) }
        : {}),
      ...(attachments.length ? { attachments } : {}),
    });

    await this.bulkEmailRepo.updateStatus(
      input.emailId,
      delivery.dryRun ? "DRY_RUN" : "SUCCESS",
    );
    return delivery;
  }

  private async loadAttachments(
    userId: string,
    assetIds: string[],
  ): Promise<DeliveryAttachment[]> {
    if (assetIds.length > 10) {
      throw new BadRequestException("bulk_email_attachment_limit_exceeded");
    }

    const attachments = await Promise.all(
      assetIds.map(async (assetId) => {
        const file = await this.assetService.getOwnedFile(assetId, userId);
        return {
          filename: file.originalFilename,
          content: file.buffer,
          contentType: file.mimeType,
          sizeBytes: file.sizeBytes,
        };
      }),
    );
    const totalSize = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
    const maxSize = this.configService.get<number>(
      "BULK_EMAIL_MAX_ATTACHMENT_BYTES",
      25 * 1024 * 1024,
    );
    if (totalSize > maxSize) {
      throw new BadRequestException("bulk_email_attachment_size_exceeded");
    }

    return attachments.map(({ sizeBytes: _sizeBytes, ...attachment }) => attachment);
  }

  private async markFailed(emailId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await this.bulkEmailRepo.updateStatus(emailId, "FAILED", message);
  }
}

function parseScheduledAt(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = isoToDate(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.valueOf() <= nowMs()) {
    throw new BadRequestException("bulk_email_schedule_must_be_in_future");
  }
  return parsed;
}

function responseForExistingRecord(record: BulkEmailStoredRecord): SendBulkEmailResponse {
  return {
    success: true,
    recipientCount: record.recipientCount,
    emailId: record.id,
    deliveryMode:
      record.status === "SCHEDULED"
        ? "scheduled"
        : record.status === "DRY_RUN"
          ? "dry_run"
          : "sent",
  };
}

function stripHtml(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
