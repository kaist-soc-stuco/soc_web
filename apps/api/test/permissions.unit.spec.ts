import { ConflictException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PermissionsService } from '../src/features/permissions/permissions.service';

const ids = {
  requester: '00000000-0000-4000-8000-000000000001',
  target: '00000000-0000-4000-8000-000000000002',
  approver: '00000000-0000-4000-8000-000000000003',
  activator: '00000000-0000-4000-8000-000000000004',
  definition: '00000000-0000-4000-8000-000000000005',
  request: '00000000-0000-4000-8000-000000000006',
};

function subject(repositoryOverrides: Record<string, unknown> = {}, bootstrapSubject = 'bootstrap-subject') {
  const repository = {
    findEffectivePermission: vi.fn().mockResolvedValue([{ id: 'grant' }]),
    findDefinition: vi.fn().mockResolvedValue({ id: ids.definition, key: 'FEE_WRITE' }),
    userExists: vi.fn().mockResolvedValue(true),
    createRequest: vi.fn().mockImplementation(async (value) => ({
      ...value,
      id: ids.request,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'PENDING',
    })),
    approveRequest: vi.fn().mockResolvedValue({
      status: 'APPROVED',
      requestedAt: new Date(),
      approvedAt: new Date(),
      activatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    activateRequest: vi.fn().mockResolvedValue({
      status: 'ACTIVATED',
      requestedAt: new Date(),
      approvedAt: new Date(),
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }),
    bootstrap: vi.fn().mockResolvedValue(true),
    findCanonicalSubject: vi.fn().mockResolvedValue('bootstrap-subject'),
    ...repositoryOverrides,
  };
  const config = { get: vi.fn().mockReturnValue(bootstrapSubject) };
  return { service: new PermissionsService(repository as never, config as never), repository, config };
}

describe('PermissionsService authority protocol', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses grants only, validates exact/global containment, and never consults legacy user permission', async () => {
    const { service, repository } = subject();
    await expect(service.hasPermission(ids.requester, 'FEE_WRITE', 'BOARD', 'board-a')).resolves.toBe(true);
    expect(repository.findEffectivePermission).toHaveBeenCalledWith(ids.requester, 'FEE_WRITE', 'BOARD', 'board-a');

    repository.findEffectivePermission.mockResolvedValueOnce([]);
    await expect(service.hasPermission(ids.requester, 'FEE_WRITE', 'EVENT', 'event-a')).resolves.toBe(false);
    expect(repository).not.toHaveProperty('findUser');
  });

  it.each(['missing', 'expired', 'revoked'])('denies a requester with %s authority before creating a request', async () => {
    const { service, repository } = subject({ findEffectivePermission: vi.fn().mockResolvedValue([]) });
    await expect(service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPERATIONS' })).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('requires PERMISSION_GRANT for grants and PERMISSION_REVOKE for revokes', async () => {
    const { service, repository } = subject();
    await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPERATIONS' });
    expect(repository.findEffectivePermission).toHaveBeenCalledWith(ids.requester, 'PERMISSION_GRANT', 'BOARD', 'board-a');
    await service.request(ids.requester, { targetUserId: ids.target, action: 'REVOKE', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPERATIONS' });
    expect(repository.findEffectivePermission).toHaveBeenLastCalledWith(ids.requester, 'PERMISSION_REVOKE', 'BOARD', 'board-a');
  });

  it('passes an immutable hash while relying on the database-owned 24-hour expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const { service, repository } = subject();
    await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPERATIONS' });
    const first = repository.createRequest.mock.calls[0][0];
    expect(first).not.toHaveProperty('expiresAt');
    await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPERATIONS_2' });
    const second = repository.createRequest.mock.calls[1][0];
    expect(first.requestHash).not.toBe(second.requestHash);
    vi.useRealTimers();
  });

  it('normalizes repository-enforced actor separation without exposing request existence', async () => {
    const { service, repository } = subject({
      approveRequest: vi.fn().mockResolvedValue(null),
      activateRequest: vi.fn().mockResolvedValue(null),
    });
    await expect(service.approve(ids.requester, ids.request, 'REVIEWED')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.approve(ids.target, ids.request, 'REVIEWED')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.activate(ids.requester, ids.request, 'EXECUTED')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.approveRequest).toHaveBeenCalledTimes(2);
    expect(repository.activateRequest).toHaveBeenCalledOnce();
  });

  it('passes transition-specific authority to transactional transitions', async () => {
    const { service, repository } = subject();
    await service.approve(ids.approver, ids.request, 'REVIEWED');
    expect(repository.approveRequest).toHaveBeenCalledWith(ids.request, ids.approver, 'REVIEWED', 'PERMISSION_APPROVE');
    await service.activate(ids.activator, ids.request, 'EXECUTED');
    expect(repository.activateRequest).toHaveBeenCalledWith(ids.request, ids.activator, 'EXECUTED', 'PERMISSION_ACTIVATE');
  });

  it('authorizes bootstrap only for the verified configured subject', async () => {
    const { service, repository } = subject();
    repository.findCanonicalSubject.mockResolvedValueOnce('other-subject');
    await expect(service.bootstrap(ids.requester)).rejects.toMatchObject({ response: { message: 'bootstrap_subject_not_authorized' } });
    expect(repository.bootstrap).not.toHaveBeenCalled();
    repository.findCanonicalSubject.mockResolvedValueOnce('bootstrap-subject');
    await expect(service.bootstrap(ids.requester)).resolves.toBe(true);
    expect(repository.bootstrap).toHaveBeenCalledWith(ids.requester, 'bootstrap-subject', expect.stringMatching(/^[a-f0-9]{64}$/), ['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE']);
  });
});
