import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { AdminFaqsController, PublicFaqsController } from '../src/features/faqs/faqs.controller';
import { FaqsService } from '../src/features/faqs/faqs.service';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard } from '../src/shared/guards/auth.guard';
import { UsersService } from '../src/features/users/users.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const topicId = '22222222-2222-4222-8222-222222222222';
const faqId = '33333333-3333-4333-8333-333333333333';
const body = { topicId, questionKr: '질문', questionEn: 'Question', answerKr: '답변', answerEn: 'Answer', displayOrder: 0, status: 'PUBLISHED' };

describe('FAQ HTTP boundary', () => {
  let app: INestApplication; let faqs: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(async () => {
    faqs = { listPublic: vi.fn(), listAdmin: vi.fn(), createTopic: vi.fn(), patchTopic: vi.fn(), deleteTopic: vi.fn(), reorderTopic: vi.fn(), createFaq: vi.fn(), patchFaq: vi.fn(), deleteFaq: vi.fn() };
    const module = await Test.createTestingModule({ controllers: [PublicFaqsController, AdminFaqsController], providers: [AuthGuard, { provide: FaqsService, useValue: faqs }, { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'session' }) } }, { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actorId }) } }] }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => { await app.close(); });
  const authenticated = (method: 'post' | 'patch' | 'put' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=token');

  it('serves public locale requests and rejects invalid locale through the service', async () => {
    faqs.listPublic.mockResolvedValue({ locale: 'en', topics: [] });
    await request(app.getHttpServer()).get('/api/faqs?locale=en').expect(200, { locale: 'en', topics: [] });
    expect(faqs.listPublic).toHaveBeenCalledWith('en');
  });

  it('does not disclose admin resources before authentication', async () => {
    const cases = [
      ['get', '/api/admin/faqs', undefined],
      ['post', '/api/admin/faqs', body],
      ['patch', `/api/admin/faqs/${faqId}`, { status: 'DRAFT' }],
      ['delete', `/api/admin/faq-topics/${topicId}`, undefined],
    ] as const;
    for (const [method, path, payload] of cases) {
      const client = request(app.getHttpServer())[method](path);
      const response = await (payload === undefined ? client : client.send(payload)).expect(401);
      expect(response.text).not.toContain(faqId);
      expect(response.text).not.toContain(topicId);
    }
    expect(Object.values(faqs).every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it('forwards authenticated CRUD and reorder requests using the authenticated actor', async () => {
    faqs.createTopic.mockResolvedValue({ id: topicId }); faqs.patchTopic.mockResolvedValue({ id: topicId }); faqs.reorderTopic.mockResolvedValue({ id: topicId }); faqs.createFaq.mockResolvedValue({ id: faqId }); faqs.patchFaq.mockResolvedValue({ id: faqId });
    await authenticated('post', '/api/admin/faq-topics').send({ titleKr: '주제', titleEn: 'Topic', displayOrder: 0 }).expect(201);
    await authenticated('patch', `/api/admin/faq-topics/${topicId}`).send({ titleEn: 'Edited' }).expect(200);
    await authenticated('put', `/api/admin/faq-topics/${topicId}/order`).send({ displayOrder: 1 }).expect(200);
    await authenticated('post', '/api/admin/faqs').send(body).expect(201);
    await authenticated('patch', `/api/admin/faqs/${faqId}`).send({ status: 'DRAFT' }).expect(200);
    await authenticated('delete', `/api/admin/faqs/${faqId}`).expect(204);
    expect(faqs.createFaq).toHaveBeenCalledWith(actorId, body);
    expect(faqs.reorderTopic).toHaveBeenCalledWith(actorId, topicId, 1);
    expect(faqs.deleteFaq).toHaveBeenCalledWith(actorId, faqId);
  });

  it('rejects unknown body keys and malformed resource IDs before service invocation', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['/api/admin/faq-topics', { titleKr: '주제', titleEn: 'Topic', displayOrder: 0, extra: true }],
      ['/api/admin/faqs', { ...body, unexpected: true }],
    ];
    for (const [path, payload] of cases) await authenticated('post', path).send(payload).expect(422);
    await authenticated('put', `/api/admin/faq-topics/${topicId}/order`).send({ displayOrder: 0, extra: true }).expect(422);
    await authenticated('patch', '/api/admin/faqs/not-a-uuid').send({ status: 'DRAFT' }).expect(422);
    await authenticated('post', '/api/admin/faqs').set('Content-Type', 'application/json').send('null').expect(400);
    await authenticated('post', '/api/admin/faq-topics').set('Content-Type', 'application/json').send('123').expect(400);
    expect(faqs.createTopic).not.toHaveBeenCalled(); expect(faqs.createFaq).not.toHaveBeenCalled();
  });
});
