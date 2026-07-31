import '@testing-library/jest-dom/vitest';

import { describe, expect, it, vi } from 'vitest';
import { ApiClientHttpError } from '@soc/api-client';

const authenticated = { authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: 'persisted' as const, userId: 'user-1' };

describe('auth session boundaries', () => {
  it('synchronously clears identity and advances the epoch for a session API 401', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    const before = auth.getAuthSessionSnapshot();
    const api = { getSession: vi.fn().mockRejectedValue(new ApiClientHttpError(401)) };

    await expect(auth.getAuthSessionSummary(api)).resolves.toEqual(auth.createEmptyAuthSession());
    expect(auth.getAuthSessionSnapshot()).toMatchObject({ epoch: before.epoch + 1, status: 'ready', session: auth.createEmptyAuthSession() });
  });

  it('rejects non-401 session failures without changing shared identity', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    const before = auth.getAuthSessionSnapshot();

    await expect(auth.getAuthSessionSummary({ getSession: vi.fn().mockRejectedValue(new TypeError('offline')) })).rejects.toThrow('offline');
    expect(auth.getAuthSessionSnapshot()).toEqual(before);
  });

  it('clears identity before credential confirmation and makes a late prior response inert at the caller boundary', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    const before = auth.getAuthSessionSnapshot();

    auth.beginAuthSessionTransition();
    expect(auth.getAuthSessionSnapshot()).toEqual({ epoch: before.epoch + 1, status: 'unknown', session: auth.createEmptyAuthSession() });
  });
  it('uses the transition epoch for its confirming observation once, then advances for a genuinely different actor', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    const before = auth.getAuthSessionSnapshot();

    auth.beginAuthSessionTransition();
    auth.setAuthSession(authenticated);
    expect(auth.getAuthSessionSnapshot()).toMatchObject({ epoch: before.epoch + 1, status: 'ready', session: authenticated });

    auth.setAuthSession({ ...authenticated, userId: 'user-2' });
    expect(auth.getAuthSessionSnapshot()).toMatchObject({ epoch: before.epoch + 2, status: 'ready', session: { userId: 'user-2' } });
  });

  it('consumes an explicit transition when its session confirmation is a 401', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    const before = auth.getAuthSessionSnapshot();

    auth.beginAuthSessionTransition();
    await expect(auth.getAuthSessionSummary({ getSession: vi.fn().mockRejectedValue(new ApiClientHttpError(401)) })).resolves.toEqual(auth.createEmptyAuthSession());
    expect(auth.getAuthSessionSnapshot()).toMatchObject({ epoch: before.epoch + 1, status: 'ready', session: auth.createEmptyAuthSession() });
  });
  it('keeps a delayed pre-transition session observation from confirming or republishing the prior actor', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    let resolveSession!: (session: typeof authenticated) => void;
    const pending = auth.getAuthSessionSummary({
      getSession: vi.fn(() => new Promise<typeof authenticated>((resolve) => { resolveSession = resolve; })),
    });

    auth.beginAuthSessionTransition();
    resolveSession(authenticated);

    await expect(pending).resolves.toEqual(auth.createEmptyAuthSession());
    expect(auth.getAuthSessionSnapshot()).toMatchObject({
      status: 'unknown',
      session: auth.createEmptyAuthSession(),
    });
  });
  it('keeps a delayed pre-transition 401 rejection from consuming the new transition confirmation', async () => {
    vi.resetModules();
    const auth = await import('@/lib/auth-session');
    auth.setAuthSession(authenticated);
    let rejectSession!: (error: Error) => void;
    const pending = auth.getAuthSessionSummary({
      getSession: vi.fn(() => new Promise<typeof authenticated>((_, reject) => { rejectSession = reject; })),
    });

    auth.beginAuthSessionTransition();
    rejectSession(new ApiClientHttpError(401));

    await expect(pending).resolves.toEqual(auth.createEmptyAuthSession());
    expect(auth.getAuthSessionSnapshot()).toMatchObject({
      status: 'unknown',
      session: auth.createEmptyAuthSession(),
    });
  });
});
