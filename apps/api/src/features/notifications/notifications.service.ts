import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ContactsService } from '../contacts/contacts.service';
import { PermissionsService } from '../permissions/permissions.service';

export type MailMessageInput = { contactIds: string[]; subject: string; body: string };

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(ContactsService) private readonly contacts: ContactsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async preview(actorUserId: string, _requestId: string, input: MailMessageInput) {
    await this.authorize(actorUserId);
    this.configuration();
    const recipients = await this.contacts.mailRecipients(input.contactIds);
    if (recipients.length !== input.contactIds.length) throw new ServiceUnavailableException('recipient_email_unavailable');
    return { ok: true as const, recipients: recipients.length, subject: input.subject.trim(), body: input.body.trim() };
  }

  async send(actorUserId: string, requestId: string, input: MailMessageInput) {
    await this.authorize(actorUserId);
    const configuration = this.configuration();
    const recipients = await this.contacts.mailRecipients(input.contactIds);
    if (recipients.length !== input.contactIds.length) throw new ServiceUnavailableException('recipient_email_unavailable');
    const id = randomUUID();
    try {
      const response = await fetch(configuration.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${configuration.token}`, 'content-type': 'application/json', 'idempotency-key': requestId },
        body: JSON.stringify({ id, from: configuration.from, to: recipients, subject: input.subject.trim(), text: input.body.trim() }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`mail_provider_${response.status}`);
      return { ok: true as const, id, status: 'SENT' as const };
    } catch {
      throw new ServiceUnavailableException('mail_provider_unavailable');
    }
  }

  async get(actorUserId: string, _requestId: string): Promise<never> { await this.authorize(actorUserId); throw new ServiceUnavailableException('operation_not_supported'); }
  async cancel(actorUserId: string, _requestId: string): Promise<never> { await this.authorize(actorUserId); throw new ServiceUnavailableException('operation_not_supported'); }

  private async authorize(actorUserId: string) {
    if (!(await this.permissions.hasPermission(actorUserId, 'MAIL_SEND', 'GLOBAL'))) throw new ForbiddenException('insufficient_permission');
  }
  private configuration() {
    if (this.config.get('MAIL_PROVIDER_ENABLED') !== true) throw new ServiceUnavailableException('feature_disabled');
    const url = this.config.get<string>('MAIL_PROVIDER_URL');
    const token = this.config.get<string>('MAIL_PROVIDER_TOKEN');
    const from = this.config.get<string>('MAIL_FROM');
    if (!url || !token || !from) throw new ServiceUnavailableException('feature_disabled');
    return { url, token, from };
  }
}
