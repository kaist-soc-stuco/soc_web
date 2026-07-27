import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { AuthSessionRepository } from '../src/features/auth/auth-session.repository';
import { AuthSessionService } from '../src/features/auth/auth-session.service';
import type { AuthSessionRecord } from '../src/features/auth/auth.types';

const now = 1_700_000_000_000;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
const config = {
  AUTH_JWT_ACTIVE_KID: 'test-key',
  AUTH_JWT_ES256_PRIVATE_KEY: privatePem,
  AUTH_JWT_PUBLIC_KEYS_JSON: JSON.stringify({ 'test-key': publicPem }),
  AUTH_JWT_ISSUER: 'https://issuer.test',
  AUTH_JWT_AUDIENCE: 'soc-api',
};
const configService = { get: (name: string) => config[name as keyof typeof config] };

function record(overrides: Partial<AuthSessionRecord> = {}): AuthSessionRecord {
  return { expiresAt: now + 60_000, familyId: 'session-1', familyVersion: 0, mode: 'persisted', refreshJti: 'refresh-1', revoked: false, sessionId: 'session-1', userId: 'user-1', ...overrides };
}

function token(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: 'ES256', kid: 'test-key' }, key = privateKey): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode(claims)}`;
  return `${input}.${sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
function tamperSignature(value: string): string {
  const parts = value.split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 1;
  return `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`;
}
function malformedRefreshToken(kind: 'payload' | 'signature' | 'padded-payload' | 'padded-signature' | 'segment-count'): string {
  const canonical = token(claims({ jti: 'refresh-1' }));
  const [header, payload, signature] = canonical.split('.');
  if (kind === 'payload') return `${header}.${Buffer.from('{').toString('base64url')}.${signature}`;
  if (kind === 'signature') return `${header}.${payload}.!`;
  if (kind === 'padded-payload') return `${header}.${payload}=.${signature}`;
  if (kind === 'padded-signature') return `${header}.${payload}.${signature}=`;
  return `${canonical}.extra`;
}

function claims(overrides: Record<string, unknown> = {}) {
  return { iss: config.AUTH_JWT_ISSUER, aud: config.AUTH_JWT_AUDIENCE, sub: 'user-1', sid: 'session-1', mode: 'persisted', iat: now / 1000, exp: now / 1000 + 60, ...overrides };
}

function service(session = record()) {
  const repository = {
    save: vi.fn(), findBySessionId: vi.fn().mockResolvedValue(session), rotateRefresh: vi.fn().mockResolvedValue('rotated'), revoke: vi.fn(),
  };
  const pending = { reserve: vi.fn(), complete: vi.fn(), release: vi.fn() };
  const users = { upsertConsentedSsoUser: vi.fn() };
  return { instance: new AuthSessionService(configService as never, repository as never, pending as never, users as never), repository, pending, users };
}

describe('AuthSessionService ES256 sessions', () => {
  it('issues exact ES256 headers, access tokens without jti, and refresh tokens with jti', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance } = service();
    const issued = await instance.issuePersistedSession('user-1');
    const decode = (value: string) => JSON.parse(Buffer.from(value, 'base64url').toString());
    expect(decode(issued.accessToken.split('.')[0])).toEqual({ alg: 'ES256', kid: 'test-key' });
    expect(decode(issued.accessToken.split('.')[1])).not.toHaveProperty('jti');
    expect(decode(issued.refreshToken.split('.')[1])).toMatchObject({ jti: expect.any(String) });
    vi.restoreAllMocks();
  });

  it.each([
    ['wrong algorithm', token(claims(), { alg: 'RS256', kid: 'test-key' })],
    ['wrong kid', token(claims(), { alg: 'ES256', kid: 'unknown' })],
    ['invalid signature', tamperSignature(token(claims()))],
    ['wrong issuer', token(claims({ iss: 'elsewhere' }))],
    ['wrong audience', token(claims({ aud: 'other-api' }))],
    ['expired', token(claims({ exp: now / 1000 - 31 }))],
    ['future issued', token(claims({ iat: now / 1000 + 31 }))],
    ['extra claim', token(claims({ role: 'admin' }))],
  ])('rejects an access token with %s', async (_reason, accessToken) => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance } = service();
    await expect(instance.validateAccessToken(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    vi.restoreAllMocks();
  });
  it.each([
    ['wrong algorithm', token(claims({ jti: 'refresh-1' }), { alg: 'RS256', kid: 'test-key' })],
    ['wrong kid', token(claims({ jti: 'refresh-1' }), { alg: 'ES256', kid: 'unknown' })],
    ['invalid signature', tamperSignature(token(claims({ jti: 'refresh-1' })))],
    ['malformed payload', malformedRefreshToken('payload')],
    ['malformed signature', malformedRefreshToken('signature')],
    ['padded payload', malformedRefreshToken('padded-payload')],
    ['padded signature', malformedRefreshToken('padded-signature')],
    ['wrong segment count', malformedRefreshToken('segment-count')],
  ])('rejects a hostile refresh token with %s before repository access', async (_reason, refreshToken) => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, repository } = service();

    await expect(instance.refreshSession({ refreshToken })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.findBySessionId).not.toHaveBeenCalled();
    expect(repository.rotateRefresh).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('binds a verified access token to its active Redis session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, repository } = service(record({ userId: 'another-user' }));
    await expect(instance.validateAccessToken(token(claims()))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.findBySessionId).toHaveBeenCalledWith('session-1');
    vi.restoreAllMocks();
  });

  it('maps refresh rotation outcomes and reports replay without a second revocation operation', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const refresh = token(claims({ jti: 'refresh-1' }));
    const current = service();
    await expect(current.instance.refreshSession({ refreshToken: refresh })).resolves.toMatchObject({ sessionId: 'session-1', storageMode: 'persisted' });
    expect(current.repository.rotateRefresh).toHaveBeenCalledWith('session-1', 'refresh-1', expect.any(String), now + 60_000);

    const retry = service(); retry.repository.rotateRefresh.mockResolvedValue('already_rotated');
    await expect(retry.instance.refreshSession({ refreshToken: refresh })).rejects.toBeInstanceOf(ConflictException);

    const stale = service(); stale.repository.rotateRefresh.mockResolvedValue('replayed');
    await expect(stale.instance.refreshSession({ refreshToken: token(claims({ jti: 'previous-refresh' })) })).rejects.toMatchObject({ message: 'refresh_replay_detected' });

    const unknown = service(); unknown.repository.rotateRefresh.mockResolvedValue('replayed');
    await expect(unknown.instance.refreshSession({ refreshToken: token(claims({ jti: 'unknown-refresh' })) })).rejects.toMatchObject({ message: 'refresh_replay_detected' });
    expect(stale.repository.rotateRefresh).toHaveBeenCalledOnce();
    expect(stale.repository.revoke).not.toHaveBeenCalled();
    // Redis atomically persists family revocation in ROTATE_REFRESH_LUA; verify its
    // post-replay stored record only in a live-Redis integration test.
    vi.restoreAllMocks();
  });
  it('reserves and completes a pending consent flow before issuing a persisted session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, pending, users, repository } = service();
    pending.reserve.mockResolvedValueOnce({ expiresAt: now + 60_000, ssoUserId: 'sso-1', userEmail: 'user@test.invalid' }).mockResolvedValueOnce(null);
    users.upsertConsentedSsoUser.mockResolvedValue({ id: 'user-1' });

    await expect(instance.handleConsentDecision({ consent: true, pendingLoginToken: 'flow-token' })).resolves.toMatchObject({ kind: 'persisted', userId: 'user-1' });
    await expect(instance.handleConsentDecision({ consent: true, pendingLoginToken: 'flow-token' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(pending.reserve).toHaveBeenCalledTimes(2);
    expect(pending.complete).toHaveBeenCalledWith('flow-token');
    expect(repository.save).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
  it('creates a temporary session after declined consent and exposes it only through its temporary handle', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, pending, repository, users } = service();
    pending.reserve.mockResolvedValue({ expiresAt: now + 60_000, ssoUserId: 'sso-1' });

    const result = await instance.handleConsentDecision({ consent: false, pendingLoginToken: 'flow-token' });
    expect(result).toMatchObject({ kind: 'temporary', temporaryHandle: expect.any(String) });
    if (result.kind !== 'temporary') throw new Error('expected a temporary session');
    repository.findBySessionId.mockImplementation(async (sessionId: string) =>
      sessionId === result.temporaryHandle ? repository.save.mock.calls[0][0] : record(),
    );
    await expect(instance.getSession({ temporaryToken: result.temporaryHandle })).resolves.toEqual({
      authenticated: true,
      canUsePersistentFeatures: false,
      requiresConsent: true,
      storageMode: 'temporary',
      userId: undefined,
    });
    await expect(instance.getSession({ temporaryToken: 'session-1' })).resolves.toEqual({
      authenticated: false,
      canUsePersistentFeatures: false,
      requiresConsent: false,
      storageMode: null,
    });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'temporary',
      pendingLoginId: 'flow-token',
    }));
    expect(pending.complete).toHaveBeenCalledWith('flow-token');
    expect(users.upsertConsentedSsoUser).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('rejects refresh claims without jti and revokes the bound session on logout', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, repository } = service();
    await expect(instance.refreshSession({ refreshToken: token(claims()) })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(instance.logout({ accessToken: token(claims()) })).resolves.toEqual({ ok: true });
    expect(repository.revoke).toHaveBeenCalledWith('session-1');
    vi.restoreAllMocks();
  });
  it('rejects non-canonical compact JWS encoding and short signatures', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance } = service();
    const canonical = token(claims());
    const [header, payload] = canonical.split('.');
    const nonCanonical = `${header}=.${payload}.${canonical.split('.')[2]}`;
    const shortSignature = `${header}.${payload}.${Buffer.alloc(63).toString('base64url')}`;

    await expect(instance.validateAccessToken(nonCanonical)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(instance.validateAccessToken(shortSignature)).rejects.toBeInstanceOf(UnauthorizedException);
    vi.restoreAllMocks();
  });

  it('does not accept a persisted session ID through the temporary handle channel', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance } = service();

    await expect(instance.getSession({ temporaryToken: 'session-1' })).resolves.toEqual({
      authenticated: false,
      canUsePersistentFeatures: false,
      requiresConsent: false,
      storageMode: null,
    });
    vi.restoreAllMocks();
  });

  it('uses a valid refresh token for logout when the access token is malformed', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, repository } = service();

    await expect(instance.logout({
      accessToken: 'malformed',
      refreshToken: token(claims({ jti: 'refresh-1' })),
    })).resolves.toEqual({ ok: true });
    expect(repository.revoke).toHaveBeenCalledWith('session-1');
    vi.restoreAllMocks();
  });

  it('releases a reserved consent flow when persistence fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, pending, users } = service();
    pending.reserve.mockResolvedValue({
      expiresAt: now + 60_000,
      ssoUserId: 'sso-1',
    });
    users.upsertConsentedSsoUser.mockRejectedValue(new Error('database unavailable'));

    await expect(instance.handleConsentDecision({
      consent: true,
      pendingLoginToken: 'flow-token',
    })).rejects.toThrow('database unavailable');
    expect(pending.release).toHaveBeenCalledWith('flow-token');
    vi.restoreAllMocks();
  });
});

describe('AuthSessionRepository rotation result mapping', () => {
  it.each([[3, 'rotated'], [4, 'already_rotated'], [2, 'replayed'], [1, 'invalid'], [0, 'missing']] as const)('maps Redis result %i to %s', async (code, expected) => {
    const redis = { eval: vi.fn().mockResolvedValue([code]) };
    const repository = new AuthSessionRepository(redis as never);
    await expect(repository.rotateRefresh('s', 'current', 'next', now + 60_000)).resolves.toBe(expected);
  });
});
