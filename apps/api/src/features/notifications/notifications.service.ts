import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PermissionsService } from '../permissions/permissions.service';

export type MailMessageInput = {
  contactIds: string[];
  subject: string;
  body: string;
};

@Injectable()
export class NotificationsService {
  constructor(@Inject(PermissionsService) private readonly permissions: PermissionsService) {}

  async preview(actorUserId: string, requestId: string, input: MailMessageInput): Promise<never> {
    return this.disableMail(actorUserId, requestId, input);
  }
  async send(actorUserId: string, requestId: string, input: MailMessageInput): Promise<never> {
    return this.disableMail(actorUserId, requestId, input);
  }
  async get(actorUserId: string, requestId: string): Promise<never> {
    return this.disableMail(actorUserId, requestId);
  }
  async cancel(actorUserId: string, requestId: string): Promise<never> {
    return this.disableMail(actorUserId, requestId);
  }

  private async disableMail(actorUserId: string, _requestId: string, _input?: MailMessageInput): Promise<never> {
    if (!(await this.permissions.hasPermission(actorUserId, 'MAIL_SEND', 'GLOBAL'))) {
      throw new ForbiddenException('insufficient_permission');
    }

    throw new ServiceUnavailableException('feature_disabled');
  }
}
