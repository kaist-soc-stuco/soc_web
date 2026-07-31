import { createHash } from 'node:crypto';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/features/users/users.service';
import { UsersRepository } from '../src/features/users/repositories/users.repository';

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const user = (id = targetId, overrides = {}) => ({
  createdAt: '2026-01-01T00:00:00.000Z', feeStatus: 'UNPAID' as const, id,
  kaistUid: 'kaist-1', majorMask: 3, nameEn: 'Ada', nameKr: '에이다', privacyConsentAt: null,
  ssoSubject: 'subject', ssoUserId: 'sso-1', studentOrEmployeeNumber: '20260001',
  updatedAt: '2026-01-02T00:00:00.000Z', userEmail: 'old@example.test', userMobile: '010-0000-0000', ...overrides,
});
const grant = (permission: string, scope: 'GLOBAL' | 'BOARD' = 'GLOBAL') => ({ activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null, id: 'grant-1', permission, scope, scopeId: null });
function repository() {
  return {
    findById: vi.fn(), findEffectiveGrants: vi.fn().mockResolvedValue(new Map()), list: vi.fn(),
    updateProfile: vi.fn(), updateFeeWithAudit: vi.fn(),
  };
}

describe('UsersService identity, permissions, fees, and audit contracts', () => {
  it('profiles only persisted records and never exposes SSO authority fields', async () => {
    const repo = repository(); repo.findById.mockResolvedValue(user());
    repo.findEffectiveGrants.mockResolvedValue(new Map([[targetId, [grant('EVENT_EDIT')]]]));
    const result = await new UsersService(repo as never).getMe(targetId);
    expect(result).toMatchObject({ id: targetId, grants: [expect.objectContaining({ permission: 'EVENT_EDIT' })] });
    expect(result).not.toHaveProperty('ssoSubject');
    expect(result).not.toHaveProperty('ssoUserId');
    expect(result).not.toHaveProperty('permission');
  });

  it('patches only mutable contact fields, ignoring immutable and legacy authority input', async () => {
    const repo = repository(); repo.updateProfile.mockResolvedValue(user(targetId, { userEmail: 'new@example.test', userMobile: null }));
    repo.findEffectiveGrants.mockResolvedValue(new Map([[targetId, []]]));
    const result = await new UsersService(repo as never).patchMe(targetId, { userEmail: 'new@example.test', userMobile: null, id: actorId, feeStatus: 'PAID', permission: 99 } as never);
    expect(repo.updateProfile).toHaveBeenCalledWith(targetId, { userEmail: 'new@example.test', userMobile: null });
    expect(result).not.toHaveProperty('permission');
    await expect(new UsersService(repo as never).patchMe(targetId, { userEmail: 'x'.repeat(321) })).rejects.toMatchObject({ response: expect.objectContaining({ message: 'invalid_profile_update' }) });
  });

  it('uses effective GLOBAL grants only; legacy permission and scoped grants cannot administer users', async () => {
    const repo = repository(); repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, [grant('USERS_MANAGE', 'BOARD')]]]));
    const service = new UsersService(repo as never);
    await expect(service.listAdmin(actorId, {})).rejects.toMatchObject({ response: expect.objectContaining({ message: 'insufficient_permission' }) });
    expect(repo.list).not.toHaveBeenCalled();
    repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, [grant('USERS_MANAGE')]]]));
    await expect(service.listAdmin(actorId, { feeStatus: 'PAID' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'insufficient_permission' }),
    });
    repo.list.mockResolvedValue([user(), user(actorId)]);
    const page = await service.listAdmin(actorId, { limit: 1 });
    expect(page.items[0]).not.toHaveProperty('feeStatus');
    expect(page.items[0]).not.toHaveProperty('userEmail');
    expect(page.items[0]).not.toHaveProperty('userMobile');
    expect(repo.list).toHaveBeenCalledWith({ limit: 2, cursor: undefined });
  });

  it('enforces deterministic cursor and page boundaries without leaking unrequested records', async () => {
    const repo = repository(); repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, [grant('USERS_MANAGE')]], [targetId, []]]));
    repo.list.mockResolvedValue([user(), user(actorId)]);
    const service = new UsersService(repo as never);
    const page = await service.listAdmin(actorId, { limit: 1 });
    expect(page.items).toHaveLength(1); expect(page.nextCursor).toBeTypeOf('string');
    await expect(service.listAdmin(actorId, { cursor: 'not-a-cursor' })).rejects.toMatchObject({ response: expect.objectContaining({ message: 'invalid_cursor' }) });
    expect(repo.list).toHaveBeenCalledTimes(1);
    for (const cursor of [
      Buffer.from(JSON.stringify({ createdAt: 'not-a-date', id: targetId })).toString('base64url'),
      Buffer.from(JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z', id: 'not-a-uuid' })).toString('base64url'),
      Buffer.from(JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z' })).toString('base64url'),
    ]) {
      await expect(service.listAdmin(actorId, { cursor })).rejects.toMatchObject({ response: expect.objectContaining({ message: 'invalid_cursor' }) });
    }
    expect(repo.list).toHaveBeenCalledTimes(1);
    await service.listAdmin(actorId, { limit: 999 });
    expect(repo.list).toHaveBeenLastCalledWith({ limit: 101, cursor: undefined });
  });

  it('does not reveal missing users or fee status before an authorized lookup', async () => {
    const repo = repository(); repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, []]]));
    const service = new UsersService(repo as never);
    await expect(service.getAdmin(actorId, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findById).not.toHaveBeenCalled();
    repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, [grant('USERS_MANAGE')]]])); repo.findById.mockResolvedValue(null);
    await expect(service.getAdmin(actorId, targetId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getFeeSelf(targetId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires grant, valid reason, and correlation before one atomic fee-and-minimized-audit operation', async () => {
    const repo = repository(); repo.findEffectiveGrants.mockResolvedValue(new Map([[actorId, [grant('FEES_MANAGE')]]]));
    const service = new UsersService(repo as never);
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'PAID', reasonCode: ' ' }, 'corr')).rejects.toMatchObject({ response: expect.objectContaining({ message: 'fee_update_audit_metadata_required' }) });
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'INVALID' as never, reasonCode: 'PAYMENT' }, '')).rejects.toMatchObject({ response: expect.objectContaining({ message: 'fee_update_audit_metadata_required' }) });
    expect(repo.updateFeeWithAudit).not.toHaveBeenCalled();
    repo.updateFeeWithAudit.mockResolvedValue(user(targetId, { feeStatus: 'PAID' }));
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'PAID', reasonCode: 'PAYMENT' }, 'corr-1')).resolves.toEqual({ userId: targetId, feeStatus: 'PAID', updatedAt: '2026-01-02T00:00:00.000Z' });
    expect(repo.updateFeeWithAudit).toHaveBeenCalledOnce();
    expect(repo.updateFeeWithAudit).toHaveBeenCalledWith({
      actorUserId: actorId,
      userId: targetId,
      feeStatus: 'PAID',
      reasonCode: 'PAYMENT',
      requestId: createHash('sha256').update('corr-1', 'utf8').digest('hex'),
      requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });
});

describe('UsersRepository fee audit transaction', () => {
  it('writes only the fee field and minimal audit metadata in the same transaction', async () => {
    const updated = {
      ...user(targetId, { feeStatus: 'PAID' as const }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      privacyConsentAt: null,
    };
    const values = vi.fn().mockResolvedValue(undefined);
    const tx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 'grant-1' }] }),
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) }))
        .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ recordId: targetId, requestFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }]) })) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([updated]) })) })) })),
      insert: vi.fn(() => ({ values: vi.fn((input) => { values(input); return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }; }) })),
    };
    const db = { transaction: vi.fn() };
    db.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    const result = await new UsersRepository(db as never, {
      encrypt: (_field: string, value: string | null) => value,
      decrypt: (_field: string, value: string | null) => value,
      looksLikeEnvelope: (value: string) => value.startsWith('enc:'),
    } as never).updateFeeWithAudit({
      actorUserId: actorId, requestId: 'corr-1', requestFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', feeStatus: 'PAID', reasonCode: 'PAYMENT', userId: targetId,
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith({
      actorUserId: actorId, action: 'FEE_STATUS_UPDATED', changedFieldNames: 'feeStatus',
      correlationId: 'corr-1', reasonCode: 'PAYMENT', recordId: targetId,
      requestFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(result).toMatchObject({ id: targetId, feeStatus: 'PAID' });
  });
});
