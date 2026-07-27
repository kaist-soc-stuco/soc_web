import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthSessionRepository } from '../src/features/auth/auth-session.repository';
import { PendingLoginRepository } from '../src/features/auth/pending-login.repository';
import type { AuthSessionRecord } from '../src/features/auth/auth.types';
import {
  CONTAINER_STARTUP_TIMEOUT_MS,
  startTestInfrastructure,
  type TestInfrastructure,
} from './utils/test-containers';

const TEST_TIMEOUT_MS = CONTAINER_STARTUP_TIMEOUT_MS * 2;
const configService = {
  get: (name: string) => name === 'AUTH_PENDING_LOGIN_ENCRYPTION_KEY'
    ? 'integration-only-pending-login-encryption-key'
    : undefined,
};

let infrastructure: TestInfrastructure;
let redis: Redis;
let sessions: AuthSessionRepository;
let pendingLogins: PendingLoginRepository;

describe('live Redis authentication transitions', () => {
  beforeAll(async () => {
    infrastructure = await startTestInfrastructure();
    redis = new Redis(infrastructure.redisUrl, { maxRetriesPerRequest: 1 });
    await redis.ping();
    await redis.flushdb();
    sessions = new AuthSessionRepository(redis);
    pendingLogins = new PendingLoginRepository(configService as never, redis);
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await redis?.quit();
    await infrastructure?.stop();
  }, TEST_TIMEOUT_MS);

  it('rotates once, conflicts within grace, and revokes the family on replay', async () => {
    const record: AuthSessionRecord = {
      expiresAt: Date.now() + 60_000,
      familyId: 'family-live',
      familyVersion: 0,
      mode: 'persisted',
      refreshJti: 'jti-current',
      revoked: false,
      sessionId: 'session-live',
      userId: 'user-live',
    };
    await sessions.save(record);

    await expect(sessions.rotateRefresh(
      record.sessionId,
      'jti-current',
      'jti-next',
      record.expiresAt,
    )).resolves.toBe('rotated');
    await expect(sessions.rotateRefresh(
      record.sessionId,
      'jti-current',
      'jti-lost-race',
      record.expiresAt,
    )).resolves.toBe('already_rotated');
    await expect(sessions.rotateRefresh(
      record.sessionId,
      'unknown-stale-jti',
      'jti-replay',
      record.expiresAt,
    )).resolves.toBe('replayed');

    await expect(sessions.findBySessionId(record.sessionId)).resolves.toMatchObject({
      familyVersion: 1,
      previousRefreshJti: 'jti-current',
      refreshJti: 'jti-next',
      revoked: true,
    });
  });

  it('reserves a pending login once, releases failures, and consumes completion', async () => {
    const expiresAt = Date.now() + 60_000;
    await pendingLogins.save('flow-live', {
      expiresAt,
      ssoUserId: 'sso-live',
      userEmail: 'live@example.invalid',
    }, 60);

    const first = await pendingLogins.reserve('flow-live');
    expect(first?.pending).toEqual({
      expiresAt,
      ssoUserId: 'sso-live',
      userEmail: 'live@example.invalid',
      userMobile: undefined,
    });
    await expect(pendingLogins.reserve('flow-live')).resolves.toBeNull();
    await pendingLogins.release('flow-live', first!.reservationToken);
    const second = (await pendingLogins.reserve('flow-live'))!;
    expect(second.pending).toMatchObject({ ssoUserId: 'sso-live' });
    await pendingLogins.complete('flow-live', second.reservationToken);
    await expect(pendingLogins.reserve('flow-live')).resolves.toBeNull();
  });
});
