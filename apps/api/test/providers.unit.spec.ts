import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/features/chat/chat.service';
import { NotificationsService } from '../src/features/notifications/notifications.service';

afterEach(() => vi.restoreAllMocks());

describe('provider adapters', () => {
  it('fails closed when chat is disabled and relays a valid configured response', async () => {
    const disabled = new ChatService({ get: vi.fn().mockReturnValue(false) } as never);
    expect(disabled.page()).toMatchObject({ kind: 'EXTERNAL_LINK_NOTICE' });
    await expect(disabled.send({ body: 'hello' })).rejects.toMatchObject({ response: { message: 'feature_disabled' } });

    const values: Record<string, unknown> = { CHAT_PROVIDER_ENABLED: true, CHAT_PROVIDER_URL: 'https://chat.example.test', CHAT_PROVIDER_TOKEN: 'token', CHAT_PROVIDER_MODEL: 'model' };
    const enabled = new ChatService({ get: vi.fn((key: string) => values[key]) } as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: ' reply ' } }] }), { status: 200 }));
    await expect(enabled.send({ body: ' hello ' })).resolves.toEqual({ ok: true, reply: 'reply' });
    expect(enabled.page()).toMatchObject({ kind: 'INTERNAL_CHAT' });
  });

  it('previews recipients and sends through the configured mail webhook', async () => {
    const permissions = { hasPermission: vi.fn().mockResolvedValue(true) };
    const contacts = { mailRecipients: vi.fn().mockResolvedValue(['one@example.test']) };
    const values: Record<string, unknown> = { MAIL_PROVIDER_ENABLED: true, MAIL_PROVIDER_URL: 'https://mail.example.test/send', MAIL_PROVIDER_TOKEN: 'token', MAIL_FROM: 'committee@example.test' };
    const service = new NotificationsService(permissions as never, contacts as never, { get: vi.fn((key: string) => values[key]) } as never);
    await expect(service.preview('actor', 'request', { contactIds: ['contact'], subject: ' Subject ', body: ' Body ' })).resolves.toEqual({ ok: true, recipients: 1, subject: 'Subject', body: 'Body' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    await expect(service.send('actor', 'request', { contactIds: ['contact'], subject: 'Subject', body: 'Body' })).resolves.toMatchObject({ ok: true, status: 'SENT' });
    expect(fetchMock).toHaveBeenCalledWith('https://mail.example.test/send', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'idempotency-key': 'request' }) }));
  });
});
