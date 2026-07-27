import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/shared/guards/auth.guard';

function contextFor(cookies: Record<string, string | undefined>) {
  const request = { cookies };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
}

describe('AuthGuard', () => {
  it('rejects a request with no access cookie before session validation', async () => {
    const sessions = { validateAccessToken: vi.fn() };
    const users = { findById: vi.fn() };
    const { context } = contextFor({});
    const guard = new AuthGuard(sessions as never, users as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'access_cookie_missing' }),
    });
    expect(sessions.validateAccessToken).not.toHaveBeenCalled();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rejects a temporary session without looking up a user', async () => {
    const sessions = { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'temporary', sub: 'pending-1', sid: 'session-1' }) };
    const users = { findById: vi.fn() };
    const { context } = contextFor({ soc_at: 'temporary-token' });
    const guard = new AuthGuard(sessions as never, users as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'session_invalid' }),
    });
    expect(sessions.validateAccessToken).toHaveBeenCalledWith('temporary-token');
    expect(users.findById).not.toHaveBeenCalled();
  });

  it.each(['session_expired_or_revoked', 'session_not_found'])('denies a %s session reported by session validation', async (message) => {
    const sessions = { validateAccessToken: vi.fn().mockRejectedValue(new UnauthorizedException(message)) };
    const users = { findById: vi.fn() };
    const { context } = contextFor({ soc_at: 'persisted-token' });
    const guard = new AuthGuard(sessions as never, users as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: expect.objectContaining({ message }),
    });
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('accepts a persisted session only when its current user exists and attaches that user', async () => {
    const sessions = { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: 'user-1', sid: 'session-1' }) };
    const users = { findById: vi.fn().mockResolvedValue({ id: 'user-1', permission: 7 }) };
    const { context, request } = contextFor({ soc_at: 'persisted-token' });
    const guard = new AuthGuard(sessions as never, users as never);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith('user-1');
    expect(request).toMatchObject({ user: { id: 'user-1', permission: 7 } });
  });

  it('rejects a persisted session whose subject no longer has a user record', async () => {
    const sessions = { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: 'deleted-user', sid: 'session-1' }) };
    const users = { findById: vi.fn().mockResolvedValue(null) };
    const { context } = contextFor({ soc_at: 'persisted-token' });
    const guard = new AuthGuard(sessions as never, users as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'user_not_found' }),
    });
  });
});
