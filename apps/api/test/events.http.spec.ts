import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { EventsService } from '../src/features/events/events.service';
import { AdminEventsController, PublicEventsController } from '../src/features/events/events.controller';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard, OptionalAuthGuard } from '../src/shared/guards';
import { UsersService } from '../src/features/users/users.service';

const actorId = '10000000-0000-4000-8000-000000000001';
const eventId = '10000000-0000-4000-8000-000000000002';
const input = { titleKr: '한국어', titleEn: 'English', descriptionKr: '설명', descriptionEn: 'Description', startAtMs: 1_772_323_200_000, endAtMs: 1_772_326_800_000, allDay: false, allDayStartDate: null, allDayEndDate: null, location: 'Room', visibility: 'PUBLIC' };

describe('Events HTTP boundary', () => {
  let app: INestApplication; let events: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(async () => {
    events = { list: vi.fn().mockResolvedValue({ locale: 'ko', items: [] }), get: vi.fn().mockResolvedValue({ id: eventId }), create: vi.fn().mockResolvedValue({ id: eventId }), patch: vi.fn().mockResolvedValue({ id: eventId }), delete: vi.fn() };
    const module = await Test.createTestingModule({ controllers: [PublicEventsController, AdminEventsController], providers: [AuthGuard, OptionalAuthGuard, { provide: EventsService, useValue: events }, { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'sid' }) } }, { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actorId }) } }] }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => { await app.close(); });
  const authenticated = (method: 'post' | 'patch' | 'delete', path: string) => request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=access-token');

  it('allows public reads with no cookie and forwards optional-cookie identity only when valid', async () => {
    await request(app.getHttpServer()).get('/api/events?fromMs=1&toMs=2&locale=en').expect(200, { locale: 'ko', items: [] });
    expect(events.list).toHaveBeenCalledWith(undefined, { fromMs: '1', toMs: '2', locale: 'en' });
    await request(app.getHttpServer()).get('/api/events?fromMs=3&toMs=4').set('Cookie', 'soc_at=access-token').expect(200);
    expect(events.list).toHaveBeenLastCalledWith(actorId, { fromMs: '3', toMs: '4', locale: undefined });
    await request(app.getHttpServer()).get('/api/events?fromMs=5&toMs=6').set('Cookie', 'soc_at=').expect(401);
    expect(events.list).toHaveBeenCalledTimes(2);
  });

  it('serves event detail and rejects malformed public requests before service invocation', async () => {
    await request(app.getHttpServer()).get(`/api/events/${eventId}?locale=ko`).expect(200);
    expect(events.get).toHaveBeenCalledWith(undefined, eventId, 'ko');
    await request(app.getHttpServer()).get('/api/events/not-a-uuid').expect(422);
    await request(app.getHttpServer()).get('/api/events?fromMs=1&toMs=2&extra=true').expect(422);
    expect(events.get).toHaveBeenCalledTimes(1);
  });

  it('keeps malformed event bodies strict without invoking services', async () => {
    for (const [method, path, body] of [['post', '/api/admin/events', { ...input, extra: true }], ['patch', `/api/admin/events/${eventId}`, []]] as const) {
      const response = await authenticated(method, path).send(body).expect(422);
      expect(response.body).toEqual({ code: 'invalid_event', message: 'Request failed', requestId: expect.any(String) });
    }
    await authenticated('patch', '/api/admin/events/not-a-uuid').send({ location: 'New room' }).expect(422);
    await authenticated('post', '/api/admin/events').set('Content-Type', 'application/json').send('null').expect(400);
    await authenticated('patch', `/api/admin/events/${eventId}`).set('Content-Type', 'application/json').send('123').expect(400);
    expect(events.create).not.toHaveBeenCalled(); expect(events.patch).not.toHaveBeenCalled();
  });

  it('requires authentication for EVENT_MANAGE writes and forwards exact bodies and UUIDs', async () => {
    const unauthenticated = await request(app.getHttpServer()).post('/api/admin/events').send(input).expect(401);
    expect(unauthenticated.body).toEqual({ code: 'access_cookie_missing', message: 'Request failed', requestId: expect.any(String) });
    expect(unauthenticated.text).not.toContain(actorId);
    await authenticated('post', '/api/admin/events').send(input).expect(201, { id: eventId });
    await authenticated('patch', `/api/admin/events/${eventId}`).send({ location: 'New room' }).expect(200, { id: eventId });
    await authenticated('delete', `/api/admin/events/${eventId}`).expect(204);
    expect(events.create).toHaveBeenCalledWith(actorId, input);
    expect(events.patch).toHaveBeenCalledWith(actorId, eventId, { location: 'New room' });
    expect(events.delete).toHaveBeenCalledWith(actorId, eventId);
  });
});
