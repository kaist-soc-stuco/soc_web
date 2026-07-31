import { ApiClientHttpError, createApiClient } from '@soc/api-client';
import { describe, expect, it, vi } from 'vitest';

const response = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    status,
  });

describe('cookie-only auth client', () => {
  it('submits only the consent decision with credentials included', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(204));
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await client.submitConsentDecision({ consent: true });

    expect(fetcher).toHaveBeenCalledWith('/api/auth/login/consent', {
      body: JSON.stringify({ consent: true }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(fetcher.mock.calls[0][1].body).not.toMatch(/token|session|flow/i);
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('token');
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('session');
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('storage');
  });
  it('starts development login with cookie credentials and no client-supplied identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(204));
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await client.loginWithDevelopmentAccount();

    expect(fetcher).toHaveBeenCalledWith('/api/auth/development/login', {
      credentials: 'include',
      method: 'POST',
    });
  });
  it('retains only canonical error code and request ID metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response(403, {
        code: 'origin_required_or_mismatch',
        message: 'attacker-controlled diagnostic text',
        requestId: 'request-123',
        token: 'secret-token',
      }),
    );
    const client = createApiClient({ baseUrl: '/api', fetcher });

    const error = await client.getSession().catch((caught: unknown) => caught);

    expect(error).toEqual(new ApiClientHttpError(403, 'origin_required_or_mismatch', 'request-123'));
    expect(error).not.toHaveProperty('message', 'attacker-controlled diagnostic text');
    expect(error).not.toHaveProperty('token');
  });

  it('falls back safely when an error response is malformed', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('not a canonical error envelope', { status: 502 }),
    );
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await expect(client.getSession()).rejects.toEqual(new ApiClientHttpError(502));
  });

  it('handles a 401 refresh failure without requiring browser redirect globals', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response(401, {
        code: 'unauthorized',
        message: 'expired session token',
        requestId: 'request-401',
      }),
    );
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await expect(client.refreshSession()).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
      requestId: 'request-401',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries refresh exactly once after a concurrent-rotation conflict', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(409))
      .mockResolvedValueOnce(response(204));
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await client.refreshSession();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/auth/refresh', {
      credentials: 'include',
      method: 'POST',
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/refresh', {
      credentials: 'include',
      method: 'POST',
    });
  });

  it('does not retry a failed refresh more than once', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(409));
    const client = createApiClient({ baseUrl: '/api', fetcher });

    await expect(client.refreshSession()).rejects.toMatchObject({ status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
