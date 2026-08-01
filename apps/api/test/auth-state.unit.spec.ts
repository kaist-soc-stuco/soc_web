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
  const authState = { compareAndDelete: vi.fn().mockResolvedValue(rawState) };
  const redis = { eval: vi.fn(), set: vi.fn() };
  const users = {
    ensureCanonicalSsoSubject: vi.fn(),
    findBySsoUserId: vi.fn().mockResolvedValue(null),
  };
  const sessions = { issuePersistedSession: vi.fn() };
  const pending = { save: vi.fn() };
  const config = { get: (name: string) => configuration[name as keyof typeof configuration] };
  return {
    instance: new AuthService(config as never, users as never, sessions as never, pending as never, authState as never, redis as never),
    redis,
    authState,
    users,
    sessions,
    pending,
  };
}

describe('AuthService SSO state consumption', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses Redis GETDEL before the SSO exchange and consumes state only once', async () => {
    const state = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, authState, pending } = makeService(state);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nonce: 'nonce-1', userInfo: {
      emp_no: 'E0001',
      kaist_uid: 'kaist-uid',
      user_email: 'sso-user@kaist.ac.kr',
      user_eng_nm: 'SSO User',
      user_id: 'sso-user',
      user_nm: '사용자',
    } }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, 'transaction-secret')).resolves.toMatchObject({ kind: 'consent_required' });
    expect(authState.compareAndDelete).toHaveBeenCalledWith('auth:sso:state:state-1', expect.any(String));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(authState.compareAndDelete.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(pending.save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ssoSubject: 'sso-user' }), 600);

    authState.compareAndDelete.mockResolvedValueOnce(null);
    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, 'transaction-secret')).rejects.toBeInstanceOf(UnauthorizedException);
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
    const { instance, authState, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, 'transaction-secret')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'invalid_or_expired_state' }),
    });
    expect(authState.compareAndDelete).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });

  it('rejects provider authorization errors before consuming state', async () => {
    const { instance, authState, users, sessions, pending } = makeService(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ error: 'access_denied', state: 'state-1' }, 'transaction-secret')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'sso_authorize_failed' }),
    });
    expect(authState.compareAndDelete).not.toHaveBeenCalled();
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
    const { instance, authState, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, 'transaction-secret')).rejects.toMatchObject({
      response: expect.objectContaining({ message }),
    });
    expect(authState.compareAndDelete.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });

  it('consumes state before a network exchange failure without creating side effects', async () => {
    const rawState = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, authState, users, sessions, pending } = makeService(rawState);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, 'transaction-secret')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'sso_exchange_failed' }),
    });
    expect(authState.compareAndDelete.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(users.findBySsoUserId).not.toHaveBeenCalled();
    expect(sessions.issuePersistedSession).not.toHaveBeenCalled();
    expect(pending.save).not.toHaveBeenCalled();
  });
  it.each([
    ['missing transaction cookie', undefined],
    ['mismatched transaction cookie', 'wrong-secret'],
  ])('rejects %s before exchange', async (_name, secret) => {
    const state = JSON.stringify({ createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000, nonce: 'nonce-1' });
    const { instance, authState } = makeService(state);
    if (secret) authState.compareAndDelete.mockResolvedValueOnce(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(instance.handleLoginCallback({ code: 'code', state: 'state-1' }, secret)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'invalid_or_expired_state' }),
    });
    if (secret) expect(authState.compareAndDelete).toHaveBeenCalledOnce();
    else expect(authState.compareAndDelete).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('issues a transaction secret and binds stored state to its hash', async () => {
    const { instance, authState } = makeService(null);
    const payload = await instance.createLoginStartPayload();
    expect(payload.transactionSecret).toEqual(expect.any(String));
    expect(authState.compareAndDelete).not.toHaveBeenCalled();
  });
});
