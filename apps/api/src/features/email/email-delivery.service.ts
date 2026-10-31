import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

import { EmailDeliveryError } from "./email-delivery-error";

export const EMAIL_DELIVERY_NOT_CONFIGURED = "email_delivery_not_configured";

export interface EmailDeliveryResult {
  dryRun: boolean;
  messageId?: string;
  acceptedCount?: number;
  rejectedCount?: number;
}

@Injectable()
export class EmailDeliveryService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private transporter?: ReturnType<typeof nodemailer.createTransport>;

  constructor(private readonly configService: ConfigService) {}

  onModuleDestroy() {
    this.transporter?.close();
  }

  async send(input: {
    recipients: string[];
    subject: string;
    content: string;
    html?: string;
    messageId?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
      cid?: string;
    }>;
  }): Promise<EmailDeliveryResult> {
    if (input.recipients.length !== 1) {
      throw new BadRequestException("email_single_recipient_required");
    }
    const dryRun = this.configService.get<boolean>(
      "EMAIL_DRY_RUN",
      this.configService.get<string>("NODE_ENV") !== "production",
    );

    if (dryRun) {
      this.logger.log(
        `Dry-run bulk email prepared for ${input.recipients.length} recipient(s): ${input.subject}`,
      );
      return { dryRun: true };
    }

    const host = this.configService.get<string>("MAIL_HOST", "smtp.gmail.com").trim();
    const from = this.configService.get<string>("MAIL_FROM")?.trim();
    const user = this.configService.get<string>("MAIL_USER")?.trim();
    const rawPassword = this.configService.get<string>("MAIL_PASS");
    const password = host.toLowerCase() === "smtp.gmail.com"
      ? rawPassword?.replace(/\s/g, "")
      : rawPassword;
    if (!host || !from || !user || !password) {
      throw new ServiceUnavailableException(EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const port = this.configService.get<number>("MAIL_PORT", 465);
    const secure = this.configService.get<boolean>("MAIL_SECURE", port === 465);
    const transporter = this.transporter ??= nodemailer.createTransport({
      host,
      pool: true,
      maxConnections: 5,
      maxRequeues: 0,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass: password },
    });

    try {
      const result = await transporter.sendMail({
        from,
        to: input.recipients[0],
        subject: input.subject,
        text: input.content,
        ...(input.html ? { html: input.html } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        ...(input.messageId ? { messageId: input.messageId } : {}),
      });
      return {
        dryRun: false,
        messageId: typeof result.messageId === "string" ? result.messageId : input.messageId,
        acceptedCount: Array.isArray(result.accepted) ? result.accepted.length : input.recipients.length,
        rejectedCount: Array.isArray(result.rejected) ? result.rejected.length : 0,
      };
    } catch (error) {
      const details = error as {
        accepted?: unknown;
        rejected?: unknown;
        messageId?: unknown;
        responseCode?: unknown;
      };
      const acceptedCount = Array.isArray(details.accepted) ? details.accepted.length : 0;
      const rejectedCount = Array.isArray(details.rejected) ? details.rejected.length : 0;
      const responseCode = typeof details.responseCode === "number" ? details.responseCode : null;
      const isDefinitePreSendFailure =
        acceptedCount === 0 && responseCode !== null && responseCode >= 500 && responseCode < 600;
      throw new EmailDeliveryError(
        isDefinitePreSendFailure ? "email_delivery_rejected" : "email_delivery_ambiguous",
        isDefinitePreSendFailure ? "pre_send" : "ambiguous",
        {
          acceptedCount,
          rejectedCount,
          providerMessageId: typeof details.messageId === "string" ? details.messageId : input.messageId,
          cause: error,
        },
      );
    }
  }
}
