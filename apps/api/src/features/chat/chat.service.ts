import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import type { ChatPageResponse } from '@soc/contracts';

const CHAT_PAGE: ChatPageResponse = {
  kind: 'EXTERNAL_LINK_NOTICE',
  externalUrl: 'https://chatgpt.com/',
  notice: 'Chat is provided by an external service. Messages are not sent to this server.',
};
const MAX_CHAT_MESSAGE_LENGTH = 4_000;

@Injectable()
export class ChatService {
  page(): ChatPageResponse {
    return { ...CHAT_PAGE };
  }

  send(input: unknown): never {
    this.validateMessage(input);
    throw new ServiceUnavailableException('feature_disabled');
  }

  private validateMessage(input: unknown): void {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new UnprocessableEntityException('invalid_chat_message');
    }

    const value = input as Record<string, unknown>;
    if (Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'body')) {
      throw new UnprocessableEntityException('invalid_chat_message');
    }

    if (typeof value.body !== 'string' || value.body.trim().length === 0 || value.body.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new UnprocessableEntityException('invalid_chat_message');
    }
  }
}
