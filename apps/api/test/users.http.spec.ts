import { ForbiddenException, INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { UsersController } from '../src/features/users/users.controller';
import { UsersService } from '../src/features/users/users.service';
import { AuthGuard } from '../src/shared/guards/auth.guard';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';

describe('UsersController HTTP boundary', () => {
  let app: INestApplication | undefined;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let sessions: { validateAccessToken: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    users = {
      findById: vi.fn().mockResolvedValue({ id: actorId, permission: 999 }), getMe: vi.fn(), patchMe: vi.fn(), getFeeSelf: vi.fn(),
      listAdmin: vi.fn(), listAdminFees: vi.fn(), getAdmin: vi.fn(), updateFeeAdmin: vi.fn(),
    };
    sessions = { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'session-1' }) };
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [AuthGuard, { provide: UsersService, useValue: users }, { provide: AuthSessionService, useValue: sessions }],
    }).compile();
    app = module.createNestApplication();
    const requestIdMiddleware = new RequestIdMiddleware();
    app.use(requestIdMiddleware.use.bind(requestIdMiddleware)); app.use(cookieParser()); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api');
    await app.init();
  });
  afterEach(async () => { await app?.close(); app = undefined; });
  const authenticatedGet = (path: string) =>
    request(app!.getHttpServer()).get(path).set('Cookie', 'soc_at=access-token');
  const authenticatedPatch = (path: string) =>
    request(app!.getHttpServer()).patch(path).set('Cookie', 'soc_at=access-token');

  it('rejects unauthenticated requests with the canonical error and no route/existence hints', async () => {
    const response = await request(app!.getHttpServer()).get(`/api/users/admin/${targetId}`).expect(401);
    expect(response.body).toEqual({ code: 'access_cookie_missing', message: 'Request failed', requestId: expect.any(String) });
    expect(response.text).not.toContain(targetId);
    expect(users.getAdmin).not.toHaveBeenCalled();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('uses the persisted actor established by AuthGuard for each USER-ME and fee-self route', async () => {
    users.getMe.mockResolvedValue({ id: actorId, userEmail: 'actor@example.test', grants: [] });
    users.patchMe.mockResolvedValue({ id: actorId, userEmail: 'actor@example.test', userMobile: '010-0000-0000', grants: [] });
    users.getFeeSelf.mockResolvedValue({ feeStatus: 'UNPAID' });
    await authenticatedGet('/api/users/me').expect(200, { id: actorId, userEmail: 'actor@example.test', grants: [] });
    await authenticatedPatch('/api/users/me').send({ userMobile: '010-0000-0000' }).expect(200);
    await authenticatedGet('/api/users/me/fee').expect(200, { feeStatus: 'UNPAID' });
    expect(users.getMe).toHaveBeenCalledWith(actorId);
    expect(users.patchMe).toHaveBeenCalledWith(actorId, { userMobile: '010-0000-0000' });
    expect(users.getFeeSelf).toHaveBeenCalledWith(actorId);
    expect(users.findById).toHaveBeenCalledTimes(3);
    expect((users.findById.mock.results[0]?.value)).toBeTruthy();
  });

  it('preserves validated admin route shapes, query values, and safe response profiles', async () => {
    users.listAdmin.mockResolvedValue({ items: [{ id: targetId, nameEn: 'Ada', grants: [] }], nextCursor: null });
    users.getAdmin.mockResolvedValue({ id: targetId, nameEn: 'Ada', grants: [] });
    const list = await authenticatedGet('/api/users/admin?limit=2&feeStatus=PAID&name=Ada').expect(200);
    const detail = await authenticatedGet(`/api/users/admin/${targetId}`).expect(200);
    expect(users.listAdmin).toHaveBeenCalledWith(actorId, { limit: '2', feeStatus: 'PAID', name: 'Ada' });
    expect(users.getAdmin).toHaveBeenCalledWith(actorId, targetId);
    expect(list.body).toEqual({ items: [{ id: targetId, nameEn: 'Ada', grants: [] }], nextCursor: null });
    expect(detail.body).toEqual({ id: targetId, nameEn: 'Ada', grants: [] });
    expect(`${list.text}${detail.text}`).not.toMatch(/ssoSubject|ssoUserId|permission|userMobile/i);
  });
  it('authorizes and shapes the current admin fee projection', async () => {
    users.listAdminFees.mockResolvedValue({
      items: [{
        id: targetId,
        kaistUid: 'k1',
        studentOrEmployeeNumber: 's1',
        nameKr: '에이다',
        nameEn: 'Ada',
        feeStatus: 'PAID',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    const response = await authenticatedGet('/api/users/admin/fees').expect(200);
    expect(response.body).toEqual({
      items: [{
        id: targetId,
        kaistUid: 'k1',
        studentOrEmployeeNumber: 's1',
        nameKr: '에이다',
        nameEn: 'Ada',
        feeStatus: 'PAID',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    expect(users.listAdminFees).toHaveBeenCalledWith(actorId, {});
  });
  it('does not expose fee rows when FEES_MANAGE is denied', async () => {
    users.listAdminFees.mockRejectedValue(new ForbiddenException('insufficient_permission'));
    const response = await authenticatedGet('/api/users/admin/fees').expect(403);
    expect(response.body).toEqual({ code: 'insufficient_permission', message: 'Request failed', requestId: expect.any(String) });
  });

  it('rejects unknown keys and malformed user IDs before forwarding to the service', async () => {
    const profile = await authenticatedPatch('/api/users/me').send({ userEmail: 'new@example.test', permission: 99 }).expect(400);
    expect(profile.body).toEqual({ code: 'invalid_profile_update', message: 'Request failed', requestId: expect.any(String) });
    const unknown = await authenticatedGet('/api/users/admin?unknown=value').expect(400);
    expect(unknown.body).toEqual({ code: 'invalid_user_query', message: 'Request failed', requestId: expect.any(String) });
    const kaistUid = await authenticatedGet('/api/users/admin?kaistUid=forbidden').expect(400);
    expect(kaistUid.body).toEqual({ code: 'invalid_user_query', message: 'Request failed', requestId: expect.any(String) });
    const detail = await authenticatedGet('/api/users/admin/not-a-uuid').expect(400);
    expect(detail.body).toEqual({ code: 'invalid_user_id', message: 'Request failed', requestId: expect.any(String) });
    const fee = await authenticatedPatch('/api/users/admin/not-a-uuid/fee').send({ feeStatus: 'PAID', reasonCode: 'PAYMENT_REVIEWED' }).expect(400);
    expect(fee.body).toEqual({ code: 'invalid_user_id', message: 'Request failed', requestId: expect.any(String) });
    const feeBody = await authenticatedPatch(`/api/users/admin/${targetId}/fee`).send({ feeStatus: 'PAID', reasonCode: 'PAYMENT_REVIEWED', unexpected: true }).expect(400);
    expect(feeBody.body).toEqual({ code: 'invalid_fee_update', message: 'Request failed', requestId: expect.any(String) });
    expect(users.getAdmin).not.toHaveBeenCalled();
    expect(users.updateFeeAdmin).not.toHaveBeenCalled();
  });

  it('passes fee audit metadata exactly and redacts forbidden or missing-user details', async () => {
    users.updateFeeAdmin.mockResolvedValue({ userId: targetId, feeStatus: 'PAID', updatedAt: '2026-01-02T00:00:00.000Z' });
    await authenticatedPatch(`/api/users/admin/${targetId}/fee`).set('x-request-id', 'request-7').send({ feeStatus: 'PAID', reasonCode: 'PAYMENT_REVIEWED' }).expect(200);
    expect(users.updateFeeAdmin).toHaveBeenCalledWith(actorId, targetId, { feeStatus: 'PAID', reasonCode: 'PAYMENT_REVIEWED' }, 'request-7');
    users.getAdmin.mockRejectedValueOnce(new ForbiddenException('insufficient_permission'));
    const denied = await authenticatedGet(`/api/users/admin/${targetId}`).expect(403);
    expect(denied.body).toEqual({ code: 'insufficient_permission', message: 'Request failed', requestId: expect.any(String) });
    users.getAdmin.mockRejectedValueOnce(new NotFoundException('user_not_found'));
    const missing = await authenticatedGet(`/api/users/admin/${targetId}`).expect(404);
    expect(missing.body).toEqual({ code: 'user_not_found', message: 'Request failed', requestId: expect.any(String) });
    expect(`${denied.text}${missing.text}`).not.toContain('Ada');
  });
});
