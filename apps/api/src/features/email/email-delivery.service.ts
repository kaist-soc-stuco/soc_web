import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

export const EMAIL_DELIVERY_NOT_CONFIGURED = "email_delivery_not_configured";

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(input: {
    recipients: string[];
    subject: string;
    content: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
      cid?: string;
    }>;
  }): Promise<{ dryRun: boolean }> {
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

    await transporter.sendMail({
      from,
      bcc: input.recipients,
      subject: input.subject,
      text: input.content,
      ...(input.html ? { html: input.html } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    });

    return { dryRun: false };
  }
}
