import '@testing-library/jest-dom/vitest';

import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectivePermissionGrant } from '@soc/contracts';

const api = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/admin-identity-api', () => ({ adminIdentityApi: api }));

const grant = (id: string, permission = 'USERS_MANAGE'): EffectivePermissionGrant => ({
  id,
  permission,
  scope: 'GLOBAL',
  scopeId: null,
  activatedFrom: '2026-01-01T00:00:00Z',
  expiresAt: null,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.resetModules();
  api.getCurrentUser.mockReset();
});

describe('admin grants store', () => {
  it('deduplicates concurrent loads and projects only grants from the current-user response', async () => {
    const pendingResponse = deferred<{ grants: EffectivePermissionGrant[]; id: string; nameKr: string }>();
    api.getCurrentUser.mockReturnValueOnce(pendingResponse.promise);
    const store = await import('@/lib/admin-grants');

    const first = store.loadAdminGrants();
    const second = store.loadAdminGrants();
    expect(first).toBe(second);
    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);

    pendingResponse.resolve({ id: 'user-1', nameKr: '홍길동', grants: [grant('grant-1')] });
    await expect(first).resolves.toEqual([grant('grant-1')]);
  });

  it('invalidates an in-flight response, refetches fresh grants, and ignores the stale response', async () => {
    const stale = deferred<{ grants: EffectivePermissionGrant[] }>();
    api.getCurrentUser.mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ grants: [grant('fresh', 'PERMISSION_AUDIT')] });
    const store = await import('@/lib/admin-grants');
    const Grants = () => createElement('output', undefined, store.useAdminGrants().grants.map((item) => item.id).join(','));

    render(createElement(Grants));
    const pending = store.loadAdminGrants();
    const refreshed = store.refetchAdminGrants();
    await expect(refreshed).resolves.toEqual([grant('fresh', 'PERMISSION_AUDIT')]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('fresh'));

    stale.resolve({ grants: [grant('stale')] });
    await expect(pending).resolves.toEqual([grant('stale')]);
    expect(screen.getByRole('status')).toHaveTextContent('fresh');
  });
});
