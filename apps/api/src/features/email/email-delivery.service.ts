import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

export const EMAIL_DELIVERY_NOT_CONFIGURED = "email_delivery_not_configured";

type EmailAddress = string | string[];

type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type EmailDeliveryInput = {
  recipients?: string[];
  to?: EmailAddress;
  cc?: EmailAddress;
  bcc?: EmailAddress;
  subject: string;
  content: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

const normalizeAddresses = (addresses?: EmailAddress): string[] => {
  if (!addresses) return [];

  const values = Array.isArray(addresses) ? addresses : [addresses];
  return values.map((address) => address.trim()).filter(Boolean);
};

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(input: EmailDeliveryInput): Promise<{ dryRun: boolean }> {
    const to = normalizeAddresses(input.to);
    const cc = normalizeAddresses(input.cc);
    const bcc = [
      ...normalizeAddresses(input.bcc),
      ...normalizeAddresses(input.recipients),
    ];
    const recipientCount = to.length + cc.length + bcc.length;

    const dryRun = this.configService.get<boolean>(
      "EMAIL_DRY_RUN",
      this.configService.get<string>("NODE_ENV") !== "production",
    );

    if (dryRun) {
      this.logger.log(
        `Dry-run email prepared for ${recipientCount} recipient(s): ${input.subject}`,
      );
      return { dryRun: true };
    }

    const host =
      this.configService.get<string>("DOORAY_SMTP_HOST") ??
      this.configService.get<string>("MAIL_HOST");
    const from =
      this.configService.get<string>("EMAIL_FROM") ??
      this.configService.get<string>("MAIL_USER");
    if (!host || !from) {
      throw new ServiceUnavailableException(EMAIL_DELIVERY_NOT_CONFIGURED);
    }

    const user =
      this.configService.get<string>("DOORAY_SMTP_USER") ??
      this.configService.get<string>("MAIL_USER");
    const password =
      this.configService.get<string>("DOORAY_SMTP_PASSWORD") ??
      this.configService.get<string>("MAIL_PASS");
    const portValue =
      this.configService.get<string | number>("DOORAY_SMTP_PORT") ??
      this.configService.get<string | number>("MAIL_PORT") ??
      587;
    const port = Number(portValue);
    const secure =
      this.configService.get<boolean>("DOORAY_SMTP_SECURE") ??
      this.configService.get<boolean>("MAIL_SECURE") ??
      false;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    await transporter.sendMail({
      from,
      ...(to.length ? { to } : {}),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      subject: input.subject,
      text: input.content,
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    });

    return { dryRun: false };
  }

  async sendMail(input: {
    to: EmailAddress;
    cc?: EmailAddress;
    bcc?: EmailAddress;
    subject: string;
    content: string;
    html?: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
  }): Promise<{ dryRun: boolean }> {
    return this.send(input);
  }
}
