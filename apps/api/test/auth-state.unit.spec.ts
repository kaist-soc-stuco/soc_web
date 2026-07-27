import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/features/auth/auth.service';

const configuration = {
  VITE_SSO_CLIENT_ID: 'client-id',
  VITE_SSO_LOGIN_URL: 'https://sso.test/login',
  VITE_SSO_REDIRECT_URI: 'https://app.test/api/auth/login',
  SSO_AUTH_API_URL: 'https://sso.test/exchange',
  SSO_CLIENT_SECRET: 'secret',
};

function makeService(rawState: string | null) {
  const redis = { getdel: vi.fn().mockResolvedValue(rawState), set: vi.fn() };
  const users = { findBySsoUserId: vi.fn().mockResolvedValue(null) };
  const sessions = { issuePersistedSession: vi.fn() };
  const pending = { save: vi.fn() };
  const config = { get: (name: string) => configuration[name as keyof typeof configuration] };
  return {
    instance: new AuthService(config as never, users as never, sessions as never, pending as never, redis as never),
    redis,
    users,
    sessions,
    pending,
  };
}

describe('AuthService SSO state consumption', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses Redis GETDEL before the SSO exchange and consumes state only once', async () => {
    const state = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, redis, pending } = makeService(state);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nonce: 'nonce-1', userInfo: { user_id: 'sso-user' } }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' })).resolves.toMatchObject({ kind: 'consent_required' });
    expect(redis.getdel).toHaveBeenCalledWith('auth:sso:state:state-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(redis.getdel.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(pending.save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ssoUserId: 'sso-user' }), 600);

    redis.getdel.mockResolvedValueOnce(null);
    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing', null],
    ['corrupt', '{not json'],
    ['expired', JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() - 1, nonce: 'nonce-1' })],
    ['state missing nonce', JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000 })],
    ['state with non-string nonce', JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 1 })],
    ['state missing expiresAt', JSON.stringify({ createdAt: new Date().toISOString(), nonce: 'nonce-1' })],
    ['state with non-number expiresAt', JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: 'tomorrow', nonce: 'nonce-1' })],
  ])('rejects %s callback state without exchanging or creating side effects', async (_name, rawState) => {
    const { instance, redis, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'invalid_or_expired_state' }),
    });
    expect(redis.getdel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });

  it('rejects provider authorization errors before consuming state', async () => {
    const { instance, redis, users, sessions, pending } = makeService(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ error: 'access_denied', state: 'state-1' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'sso_authorize_failed' }),
    });
    expect(redis.getdel).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });

  it.each([
    ['nonce mismatch', { ok: true, json: async () => ({ nonce: 'wrong', userInfo: { user_id: 'sso-user' } }) }, 'nonce_mismatch'],
    ['non-OK response', { ok: false, json: async () => ({}) }, 'sso_exchange_failed'],
    ['invalid JSON', { ok: true, json: async () => { throw new Error('invalid json'); } }, 'sso_exchange_failed'],
  ])('consumes state before rejecting %s without creating a session or pending login', async (_name, response, message) => {
    const rawState = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, redis, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' })).rejects.toMatchObject({
      response: expect.objectContaining({ message }),
    });
    expect(redis.getdel.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });

  it('consumes state before a network exchange failure without creating side effects', async () => {
    const rawState = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, redis, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'sso_exchange_failed' }),
    });
    expect(redis.getdel.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });
});
