import { ConflictException, ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { PermissionsController } from '../src/features/permissions/permissions.controller';
import { PermissionsService } from '../src/features/permissions/permissions.service';
import { UsersService } from '../src/features/users/users.service';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard } from '../src/shared/guards/auth.guard';

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const input = { targetUserId: targetId, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-1', reasonCode: 'OPS' };

describe('PermissionsController HTTP boundary', () => {
  let app: INestApplication | undefined;
  let permissions: Record<string, ReturnType<typeof vi.fn>>;
  let users: { findById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    permissions = { request: vi.fn(), approve: vi.fn(), activate: vi.fn(), bootstrap: vi.fn(), backfillLegacyPermissions: vi.fn(), hasPermission: vi.fn(), listAudit: vi.fn() };
    users = { findById: vi.fn().mockResolvedValue({ id: actorId, permission: 999 }) };
    const module = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        AuthGuard,
        { provide: PermissionsService, useValue: permissions },
        { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'session-1' }) } },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser()); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => { await app?.close(); app = undefined; });
  const post = (path: string) => request(app!.getHttpServer()).post(path).set('Cookie', 'soc_at=access-token');
  const get = (path: string) => request(app!.getHttpServer()).get(path).set('Cookie', 'soc_at=access-token');

  it('does not disclose permission routes or request existence before authentication', async () => {
    for (const [method, path] of [['post', '/api/permissions/requests'], ['post', `/api/permissions/requests/${requestId}/approve`], ['post', `/api/permissions/requests/${requestId}/activate`], ['post', '/api/permissions/bootstrap'], ['post', '/api/permissions/backfill/legacy'], ['get', '/api/permissions/audit']] as const) {
      const client = request(app!.getHttpServer());
      const response = await (method === 'get' ? client.get(path) : client.post(path)).expect(401);
      expect(response.body).toEqual({ code: 'access_cookie_missing', message: 'Request failed', requestId: expect.any(String) });
      expect(response.text).not.toContain(requestId);
    }
    expect(Object.values(permissions).every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it('forwards only a valid permission request from the authenticated actor', async () => {
    permissions.request.mockResolvedValue({ id: requestId, status: 'PENDING' });
    await post('/api/permissions/requests').send(input).expect(201, { id: requestId, status: 'PENDING' });
    expect(permissions.request).toHaveBeenCalledWith(actorId, input);
  });

  it('rejects malformed request actions, UUIDs, scopes, reasons, and unknown body keys at the boundary', async () => {
    const { scopeId: _scopeId, ...missingScopeId } = input;
    const invalidBodies = [
      { ...input, targetUserId: 'not-a-uuid' }, { ...input, action: 'APPROVE' }, { ...input, scope: 'NOPE' },
      { ...input, scope: 'GLOBAL', scopeId: 'board-1' }, missingScopeId, { ...input, reasonCode: 'bad reason' }, { ...input, unexpected: true },
    ];
    for (const body of invalidBodies) {
      const response = await post('/api/permissions/requests').send(body).expect(400);
      expect(response.body).toEqual({ code: 'invalid_permission_request', message: 'Request failed', requestId: expect.any(String) });
    }
    expect(permissions.request).not.toHaveBeenCalled();
  });

  it('approves and activates valid requests, while rejecting malformed IDs, reasons, and unknown keys', async () => {
    permissions.approve.mockResolvedValue({ id: requestId, status: 'APPROVED' });
    permissions.activate.mockResolvedValue({ id: requestId, status: 'ACTIVATED' });
    await post(`/api/permissions/requests/${requestId}/approve`).send({ reasonCode: 'REVIEWED' }).expect(201);
    await post(`/api/permissions/requests/${requestId}/activate`).send({ reasonCode: 'ACTIVATE' }).expect(201);
    expect(permissions.approve).toHaveBeenCalledWith(actorId, requestId, 'REVIEWED');
    expect(permissions.activate).toHaveBeenCalledWith(actorId, requestId, 'ACTIVATE');
    for (const path of ['/api/permissions/requests/not-a-uuid/approve', `/api/permissions/requests/${requestId}/activate`]) {
      const response = await post(path).send(path.includes('not-a-uuid') ? { reasonCode: 'OPS' } : { reasonCode: 'bad reason', extra: true }).expect(400);
      expect(response.body).toEqual({ code: path.includes('not-a-uuid') ? 'invalid_permission_request_id' : 'reason_code_required', message: 'Request failed', requestId: expect.any(String) });
    }
    permissions.approve.mockRejectedValueOnce(new ConflictException('permission_request_not_approvable'));
    const missing = await post(`/api/permissions/requests/${requestId}/approve`).send({ reasonCode: 'OPS' }).expect(409);
    expect(missing.body).toEqual({ code: 'permission_request_not_approvable', message: 'Request failed', requestId: expect.any(String) });
    expect(missing.text).not.toContain(requestId);
  });

  it('blocks bootstrap and backfill unless operations are enabled, then forwards the actor', async () => {
    const previous = process.env.AUTHORIZATION_OPERATIONS_ENABLED;
    delete process.env.AUTHORIZATION_OPERATIONS_ENABLED;
    for (const path of ['/api/permissions/bootstrap', '/api/permissions/backfill/legacy']) {
      const response = await post(path).expect(403);
      expect(response.body).toEqual({ code: 'authorization_operations_disabled', message: 'Request failed', requestId: expect.any(String) });
    }
    expect(permissions.bootstrap).not.toHaveBeenCalled(); expect(permissions.backfillLegacyPermissions).not.toHaveBeenCalled();
    process.env.AUTHORIZATION_OPERATIONS_ENABLED = 'true';
    permissions.bootstrap.mockResolvedValue(true); permissions.backfillLegacyPermissions.mockResolvedValue({ processed: 1, completed: false });
    await post('/api/permissions/bootstrap').expect(201, { completed: true });
    await post('/api/permissions/backfill/legacy').expect(201, { processed: 1, completed: false });
    expect(permissions.bootstrap).toHaveBeenCalledWith(actorId);
    expect(permissions.backfillLegacyPermissions).toHaveBeenCalledWith(actorId);
    if (previous === undefined) delete process.env.AUTHORIZATION_OPERATIONS_ENABLED; else process.env.AUTHORIZATION_OPERATIONS_ENABLED = previous;
  });

  it('requires audit capability before pagination validation and forwards validated pagination', async () => {
    permissions.hasPermission.mockResolvedValueOnce(false);
    const denied = await get('/api/permissions/audit?limit=2').expect(403);
    expect(denied.body).toEqual({ code: 'insufficient_permission', message: 'Request failed', requestId: expect.any(String) });
    expect(permissions.listAudit).not.toHaveBeenCalled();
    permissions.hasPermission.mockResolvedValue(true); permissions.listAudit.mockResolvedValue({ items: [], nextCursor: null });
    await get('/api/permissions/audit?limit=2&cursor=cursor-1').expect(200, { items: [], nextCursor: null });
    expect(permissions.hasPermission).toHaveBeenLastCalledWith(actorId, 'PERMISSION_AUDIT', 'GLOBAL');
    expect(permissions.listAudit).toHaveBeenCalledWith(2, 'cursor-1');
    for (const query of ['?limit=0', '?limit=101', '?unknown=value']) {
      const response = await get(`/api/permissions/audit${query}`).expect(400);
      expect(response.body).toEqual({ code: 'invalid_audit_query', message: 'Request failed', requestId: expect.any(String) });
    }
    permissions.listAudit.mockRejectedValueOnce(new ForbiddenException('audit_denied'));
    const canonical = await get('/api/permissions/audit').expect(403);
    expect(canonical.body).toEqual({ code: 'audit_denied', message: 'Request failed', requestId: expect.any(String) });
  });
});
