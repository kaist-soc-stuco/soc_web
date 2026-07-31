import { GUARDS_METADATA } from '@nestjs/common/constants';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatController, ChatMessagesController } from '../src/features/chat/chat.controller';
import { ChatService } from '../src/features/chat/chat.service';
import { ContactsController } from '../src/features/contacts/contacts.controller';
import { ContactsService } from '../src/features/contacts/contacts.service';
import { NotificationsController } from '../src/features/notifications/notifications.controller';
import { NotificationsService } from '../src/features/notifications/notifications.service';
import { PermissionsService } from '../src/features/permissions/permissions.service';
import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { UsersService } from '../src/features/users/users.service';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard, OptionalAuthGuard } from '../src/shared/guards';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

const actor = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const contact = { id, name: 'Ada', email: 'ada@example.test', phone: null, affiliation: null, note: null, kaistUid: null, year: null, role: null, projection: 'FULL', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletedAt: null, retentionDeadlineAt: '2026-02-01T00:00:00.000Z', holdUntil: null };

describe('Phase 6 HTTP contracts', () => {
  let app: INestApplication; let contacts: Record<string, ReturnType<typeof vi.fn>>; let permissions: { hasPermission: ReturnType<typeof vi.fn> }; let notifications: NotificationsService;
  beforeEach(async () => {
    contacts = { list: vi.fn(), create: vi.fn(), patch: vi.fn(), delete: vi.fn(), mailRecipients: vi.fn().mockResolvedValue(['ada@example.test']) };
    permissions = { hasPermission: vi.fn().mockResolvedValue(true) };
    const sessions = { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actor, sid: 'session-1' }) };
    const configuration = {
      MAIL_PROVIDER_ENABLED: true,
      MAIL_PROVIDER_URL: 'https://mail.example.test/send',
      MAIL_PROVIDER_TOKEN: 'mail-token',
      MAIL_FROM: 'committee@example.test',
      CHAT_PROVIDER_ENABLED: true,
      CHAT_PROVIDER_URL: 'https://chat.example.test',
      CHAT_PROVIDER_TOKEN: 'chat-token',
      CHAT_PROVIDER_MODEL: 'committee-chat',
    } as const;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Committee reply' } }] }) }));
    const module = await Test.createTestingModule({ controllers: [ContactsController, NotificationsController, ChatController, ChatMessagesController], providers: [AuthGuard, OptionalAuthGuard, ChatService, NotificationsService, { provide: ConfigService, useValue: { get: vi.fn((key: keyof typeof configuration) => configuration[key]) } }, { provide: ContactsService, useValue: contacts }, { provide: PermissionsService, useValue: permissions }, { provide: AuthSessionService, useValue: sessions }, { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actor }) } }] }).compile();
    notifications = module.get(NotificationsService); vi.spyOn(notifications, 'preview'); vi.spyOn(notifications, 'send'); app = module.createNestApplication(); const middleware = new RequestIdMiddleware(); app.use(middleware.use.bind(middleware)); app.use(cookieParser()); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => { await app?.close(); vi.unstubAllGlobals(); });
  const get = (path: string) => request(app.getHttpServer()).get(path).set('Cookie', 'soc_at=token');
  const post = (path: string) => request(app.getHttpServer()).post(path).set('Cookie', 'soc_at=token');
  const patch = (path: string) => request(app.getHttpServer()).patch(path).set('Cookie', 'soc_at=token');
  const del = (path: string) => request(app.getHttpServer()).delete(path).set('Cookie', 'soc_at=token');

  it('registers AuthGuard on contact and mail controllers', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ContactsController)).toContain(AuthGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationsController)).toContain(AuthGuard);
  });
  it('uses exact contact routes, validates UUID/query/body, and propagates request ids', async () => {
    contacts.list.mockResolvedValue({ items: [contact], nextCursor: null }); contacts.create.mockResolvedValue({ contact }); contacts.patch.mockResolvedValue({ contact });
    await get('/api/admin/contacts?limit=2&projection=FULL').expect(200, { items: [contact], nextCursor: null });
    await post('/api/admin/contacts').set('x-request-id', 'phase6-1').send({ name: 'Ada' }).expect(201);
    await patch(`/api/admin/contacts/${id}`).set('x-request-id', 'phase6-2').send({ note: 'Hi' }).expect(200);
    await del(`/api/admin/contacts/${id}`).set('x-request-id', 'phase6-3').send({ reasonCode: 'REMOVED' }).expect(204);
    expect(contacts.list).toHaveBeenCalledWith(actor, { limit: '2', projection: 'FULL' }, expect.any(String));
    expect(contacts.create).toHaveBeenCalledWith(actor, { name: 'Ada' }, 'phase6-1'); expect(contacts.patch).toHaveBeenCalledWith(actor, id, { note: 'Hi' }, 'phase6-2'); expect(contacts.delete).toHaveBeenCalledWith(actor, id, 'REMOVED', 'phase6-3');
    const invalid = await patch('/api/admin/contacts/not-uuid').send({ name: 'Ada' }).expect(422); expect(invalid.body).toEqual({ code: 'invalid_contact_id', message: 'Request failed', requestId: expect.any(String) });
    await get('/api/admin/contacts?unknown=1').expect(422); await post('/api/admin/contacts').send({ name: 'Ada', extra: true }).expect(422);
  });

  it('requires authentication and MAIL_SEND before configured mail operations', async () => {
    await request(app.getHttpServer()).get('/api/admin/contacts').expect(401); await request(app.getHttpServer()).post('/api/admin/mail/preview').send({ contactIds: [id], subject: 's', body: 'b' }).expect(401);
    permissions.hasPermission.mockResolvedValueOnce(false);
    const forbidden = await post('/api/admin/mail/preview').send({ contactIds: [id], subject: 's', body: 'b' }).expect(403); expect(forbidden.body).toMatchObject({ code: 'insufficient_permission' });
    await post('/api/admin/mail/preview').send({ contactIds: [id], subject: 's', body: 'b' }).expect(200, { ok: true, recipients: 1, subject: 's', body: 'b' });
    const sent = await post('/api/admin/mail').send({ contactIds: [id], subject: 's', body: 'b' }).expect(202);
    expect(sent.body).toMatchObject({ ok: true, id: expect.any(String), status: 'SENT' });
    for (const [method, path, body] of [['get', `/api/admin/mail/${id}`, undefined], ['post', `/api/admin/mail/${id}/cancel`, { reasonCode: 'CANCELLED' }]] as const) {
      const response = method === 'get' ? await get(path).expect(503) : await post(path).send(body).expect(503); expect(response.body).toEqual({ code: 'operation_not_supported', message: 'Internal server error', requestId: expect.any(String) });
    }
    expect(notifications.preview).toHaveBeenCalledWith(actor, expect.any(String), { contactIds: [id], subject: 's', body: 'b' });
    expect(notifications.send).toHaveBeenCalledWith(actor, expect.any(String), { contactIds: [id], subject: 's', body: 'b' });
    await post('/api/admin/mail/preview?bad=1').send({ contactIds: [id], subject: 's', body: 'b' }).expect(400); await get('/api/admin/mail/not-uuid').expect(400);
  });

  it('serves configured chat and authenticates and strictly validates messages', async () => {
    await request(app.getHttpServer()).get('/api/chat').expect(200, { kind: 'INTERNAL_CHAT', notice: 'Messages are sent to the configured committee chat provider.' });
    await request(app.getHttpServer()).post('/api/chat/messages').send({ body: 'hello' }).expect(401);
    const invalid = await post('/api/chat/messages').send({ body: ' ', extra: true }).expect(422); expect(invalid.body).toMatchObject({ code: 'invalid_chat_message' });
    const sent = await post('/api/chat/messages').send({ body: 'hello' }).expect(201); expect(sent.body).toEqual({ ok: true, reply: 'Committee reply' }); expect(JSON.stringify(sent.body)).not.toContain('hello');
  });
});
