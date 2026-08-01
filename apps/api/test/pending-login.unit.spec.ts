import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PendingLoginRepository } from '../src/features/auth/pending-login.repository';

const now = 1_700_000_000_000;
const configService = {
  get: (name: string) => name === 'AUTH_PENDING_LOGIN_ENCRYPTION_KEY'
    ? 'test-only-pending-login-encryption-key'
    : undefined,
};

function repository() {
  let stored: string | null = null;
  const redis = {
    del: vi.fn(async () => {
      stored = null;
      return 1;
    }),
    eval: vi.fn(),
    get: vi.fn(async () => stored),
    getdel: vi.fn(async () => {
      const value = stored;
      stored = null;
      return value;
    }),
    set: vi.fn(async (_key: string, value: string) => {
      stored = value;
      return 'OK';
    }),
  };

  return {
    instance: new PendingLoginRepository(configService as never, redis as never),
    redis,
    readStored: () => stored,
    writeStored: (value: string | null) => {
      stored = value;
    },
  };
}

describe('PendingLoginRepository', () => {
  const profile = {
    kaistUid: 'kaist-uid-1',
    nameEn: 'Test Person',
    nameKr: '테스트',
    ssoSubject: 'sso-subject-1',
    studentOrEmployeeKind: 'STUDENT' as const,
    studentOrEmployeeNumber: '20260001',
    userEmail: 'person@kaist.ac.kr',
  };
  it('encrypts the SSO subject and optional PII at rest and decrypts it on read', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, readStored, redis } = repository();
    const pending = {
      ...profile,
      expiresAt: now + 60_000,
    };

    await instance.save('flow-token', pending, 60);

    const raw = readStored();
    expect(raw).toBeTruthy();
    expect(raw).not.toContain(pending.ssoSubject);
    expect(raw).not.toContain(pending.userEmail);
    expect(raw).not.toContain(pending.studentOrEmployeeNumber);
    redis.eval.mockResolvedValueOnce([1, raw]);
    await expect(instance.reserve('flow-token')).resolves.toMatchObject({ pending, reservationToken: expect.any(String) });
  });

  it('fails closed with an operational error when authenticated ciphertext is corrupted', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, readStored, redis, writeStored } = repository();
    await instance.save('flow-token', {
      ...profile,
      expiresAt: now + 60_000,
    }, 60);

    const parsed = JSON.parse(readStored()!) as { encryptedProfile: string };
    const [iv, tag, encrypted] = parsed.encryptedProfile.split('.');
    const tamperedTag = Buffer.from(tag, 'base64url');
    tamperedTag[0] ^= 1;
    parsed.encryptedProfile = `${iv}.${tamperedTag.toString('base64url')}.${encrypted}`;
    writeStored(JSON.stringify(parsed));
    redis.eval.mockResolvedValueOnce([1, readStored()]);

    await expect(instance.reserve('flow-token')).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('reserves the encrypted record atomically and completes it by deletion', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, readStored, redis } = repository();
    const pending = {
      ...profile,
      expiresAt: now + 60_000,
    };
    await instance.save('flow-token', pending, 60);
    redis.eval.mockResolvedValueOnce([1, readStored()]);

    const reservation = (await instance.reserve('flow-token'))!;
    expect(reservation.pending).toEqual(pending);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('record.state = "processing"'),
      1,
      'auth:pending-login:flow-token',
      String(now),
      '30000',
      expect.any(String),
    );
    await instance.complete('flow-token', 'stale-owner-token');
    expect(redis.eval).toHaveBeenLastCalledWith(expect.stringContaining('reservationToken ~= ARGV[1]'), 1, 'auth:pending-login:flow-token', 'stale-owner-token');
    await instance.complete('flow-token', reservation.reservationToken);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('reservationToken ~= ARGV[1]'), 1, 'auth:pending-login:flow-token', reservation.reservationToken);
  });
  it('does not renew a lease after a competing consent owner takes it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, readStored, redis } = repository();
    await instance.save('flow-token', { ...profile, expiresAt: now + 60_000 }, 60);
    redis.eval.mockResolvedValueOnce([1, readStored()]);
    const reservation = (await instance.reserve('flow-token'))!;
    redis.eval.mockResolvedValueOnce(0);

    await expect(instance.renew('flow-token', reservation.reservationToken)).resolves.toBe(false);
    expect(redis.eval).toHaveBeenLastCalledWith(
      expect.stringContaining('leaseExpiresAtMs'),
      1,
      'auth:pending-login:flow-token',
      reservation.reservationToken,
      String(now),
      '30000',
    );
    vi.restoreAllMocks();
  });
});
