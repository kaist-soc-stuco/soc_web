import {
  Injectable,
  Logger,
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
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(private readonly configService: ConfigService) {}

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

    const host = this.configService.get<string>("DOORAY_SMTP_HOST");
    const from = this.configService.get<string>("EMAIL_FROM");
    if (!host || !from) {
      throw new ServiceUnavailableException(EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const user = this.configService.get<string>("DOORAY_SMTP_USER");
    const password = this.configService.get<string>("DOORAY_SMTP_PASSWORD");
    const transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>("DOORAY_SMTP_PORT", 587),
      secure: this.configService.get<boolean>("DOORAY_SMTP_SECURE", false),
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    try {
      const result = await transporter.sendMail({
        from,
        bcc: input.recipients,
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
