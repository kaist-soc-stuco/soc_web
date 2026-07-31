import { Inject, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatPageResponse } from '@soc/contracts';

const MAX_CHAT_MESSAGE_LENGTH = 4_000;

@Injectable()
export class ChatService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  page(): ChatPageResponse {
    return this.configuration()
      ? { kind: 'INTERNAL_CHAT', notice: 'Messages are sent to the configured committee chat provider.' }
      : { kind: 'EXTERNAL_LINK_NOTICE', externalUrl: 'https://chatgpt.com/', notice: 'Chat API is not configured. Messages are not sent to this server.' };
  }

  async send(input: unknown): Promise<{ ok: true; reply: string }> {
    const body = this.validateMessage(input);
    const configuration = this.configuration();
    if (!configuration) throw new ServiceUnavailableException('feature_disabled');
    try {
      const response = await fetch(`${configuration.url}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${configuration.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: configuration.model, messages: [{ role: 'user', content: body }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`chat_provider_${response.status}`);
      const payload: unknown = await response.json();
      const reply = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('invalid_chat_provider_response');
      return { ok: true, reply: reply.trim() };
    } catch {
      throw new ServiceUnavailableException('chat_provider_unavailable');
    }
  }

  private validateMessage(input: unknown): string {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new UnprocessableEntityException('invalid_chat_message');
    const value = input as Record<string, unknown>;
    if (Object.keys(value).length !== 1 || typeof value.body !== 'string' || value.body.trim().length === 0 || value.body.length > MAX_CHAT_MESSAGE_LENGTH) throw new UnprocessableEntityException('invalid_chat_message');
    return value.body.trim();
  }

  private configuration() {
    if (this.config.get('CHAT_PROVIDER_ENABLED') !== true) return null;
    const url = this.config.get<string>('CHAT_PROVIDER_URL');
    const token = this.config.get<string>('CHAT_PROVIDER_TOKEN');
    const model = this.config.get<string>('CHAT_PROVIDER_MODEL');
    return url && token && model ? { url, token, model } : null;
  }
}
