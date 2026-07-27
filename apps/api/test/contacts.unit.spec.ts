import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ContactsService } from '../src/features/contacts/contacts.service';

const actor = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-01-02T00:00:00.000Z');
const correlation = 'request-7';
const input = { name: ' Ada ', email: 'ada@example.test', phone: null, affiliation: null, note: null, kaistUid: null, year: null, role: null };
const row = {
  id, createdAt: now, updatedAt: now, deletedAt: null, retentionDeadlineAt: new Date('2026-02-01T00:00:00.000Z'), holdUntil: null,
  nameEnvelope: 'name:Ada', emailEnvelope: 'email:ada@example.test', phoneEnvelope: null, affiliationEnvelope: null, noteEnvelope: null, kaistUidEnvelope: null, yearEnvelope: null, roleEnvelope: null,
};

function subject(options: { permitted?: boolean; graceDays?: unknown } = {}) {
  const repository = { list: vi.fn(), create: vi.fn(), patch: vi.fn(), softDelete: vi.fn(), purge: vi.fn() };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(options.permitted ?? true) };
  const cipher = { encrypt: vi.fn((field: string, value: string) => `${field}:${value}`), decrypt: vi.fn((_field: string, value: string | null) => value?.slice(value.indexOf(':') + 1) ?? null) };
  const clock = { now: vi.fn(() => now) };
  const config = { get: vi.fn(() => options.graceDays ?? 30) };
  return { service: new ContactsService(repository as never, permissions as never, cipher as never, clock as never, config as never), repository, permissions, cipher };
}

describe('ContactsService', () => {
  it('encrypts strict create input, decrypts full output, and defaults the retention deadline', async () => {
    const { service, repository, cipher } = subject(); repository.create.mockResolvedValue(row);
    await expect(service.create(actor, input, correlation)).resolves.toMatchObject({ contact: { projection: 'FULL', name: 'Ada', email: 'ada@example.test', retentionDeadlineAt: '2026-02-01T00:00:00.000Z' } });
    expect(cipher.encrypt).toHaveBeenCalledWith('name', 'Ada');
    expect(repository.create.mock.calls[0]?.[1]).toMatchObject({ nameEnvelope: 'name:Ada', retentionDeadlineAt: new Date('2026-02-01T00:00:00.000Z') });
    expect(repository.create.mock.calls[0]?.[2]).toMatchObject({ changedFieldNames: 'name,email,phone,affiliation,note,kaistUid,year,role,retentionDeadlineAt,holdUntil' });
    await expect(service.create(actor, { ...input, unexpected: true } as never, correlation)).rejects.toMatchObject({ response: { message: 'invalid_contact' } });
    await expect(service.create(actor, { ...input, name: ' ' }, correlation)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('projects list values as masked or full and supplies a cursor', async () => {
    const { service, repository } = subject(); repository.list.mockResolvedValue([row, { ...row, id: '33333333-3333-4333-8333-333333333333' }]);
    const masked = await service.list(actor, { limit: '1' });
    expect(masked.items[0]).toMatchObject({ projection: 'MASKED', name: 'A***', email: '***', note: null }); expect(masked.nextCursor).toEqual(expect.any(String));
    repository.list.mockResolvedValue([row]);
    await expect(service.list(actor, { projection: 'FULL' })).resolves.toMatchObject({ items: [expect.objectContaining({ name: 'Ada', email: 'ada@example.test', projection: 'FULL' })] });
  });

  it('denies before repository access and maps create, patch, and delete outcomes', async () => {
    const denied = subject({ permitted: false });
    await expect(denied.service.list(actor, {})).rejects.toBeInstanceOf(ForbiddenException); expect(denied.repository.list).not.toHaveBeenCalled();
    const { service, repository } = subject();
    repository.create.mockResolvedValue(null); await expect(service.create(actor, input, correlation)).rejects.toBeInstanceOf(ForbiddenException);
    repository.patch.mockResolvedValueOnce(false).mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    await expect(service.patch(actor, id, { name: 'Grace' }, correlation)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.patch(actor, id, { name: 'Grace' }, correlation)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.patch(actor, id, { name: 'Grace' }, correlation)).resolves.toMatchObject({ contact: { name: 'Ada' } });
    repository.softDelete.mockResolvedValueOnce(null).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(service.delete(actor, id, 'REMOVED', correlation)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete(actor, id, 'REMOVED', correlation)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.delete(actor, id, 'REMOVED', correlation)).resolves.toBeUndefined();
  });

  it('enforces cursor, limit, dates, reason, correlation, and grace-day boundaries', async () => {
    const { service } = subject();
    for (const query of [{ limit: '0' }, { limit: '51' }, { cursor: 'bad' }, { projection: 'SECRET' }, { includeDeleted: 'yes' }]) await expect(service.list(actor, query)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.create(actor, { ...input, retentionDeadlineAt: '2026-01-02' }, correlation)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.delete(actor, id, 'bad', correlation)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.create(actor, input, '!bad')).rejects.toBeInstanceOf(UnprocessableEntityException);
    for (const graceDays of [0, 366, 'x']) await expect(subject({ graceDays }).service.create(actor, input, correlation)).rejects.toThrow('invalid_contact_purge_grace_days');
  });
});
