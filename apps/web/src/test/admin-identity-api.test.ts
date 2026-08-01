import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';

const grant = { id: 'grant-1', permission: 'USERS_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00Z', expiresAt: null };
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: vi.fn().mockResolvedValue(body) });
const currentUser = {
  feeStatus: 'UNKNOWN',
  id: 'user-1',
  kaistUid: null,
  majorMask: 0,
  nameEn: null,
  nameKr: null,
  privacyConsentAt: null,
  studentOrEmployeeKind: null,
  studentOrEmployeeNumber: null,
  userEmail: null,
  userMobile: null,
  grants: [grant],
};

afterEach(() => vi.unstubAllGlobals());

describe('adminIdentityApi', () => {
  it('uses cookie credentials and preserves only grants from the current-user payload', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...currentUser, unexpected: true }));
    vi.stubGlobal('fetch', fetch);

    await expect(adminIdentityApi.getCurrentUser()).rejects.toBeInstanceOf(AdminIdentityApiProtocolError);
    fetch.mockResolvedValueOnce(response(currentUser));
    await expect(adminIdentityApi.getCurrentUser()).resolves.toEqual({ grants: [grant] });
    fetch.mockResolvedValueOnce(response({ ...currentUser, studentOrEmployeeKind: 'INVALID' }));
    await expect(adminIdentityApi.getCurrentUser()).rejects.toBeInstanceOf(AdminIdentityApiProtocolError);
    expect(fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({ credentials: 'include', headers: { Accept: 'application/json' } }));

  });

  it('decodes only exact server errors and rejects malformed successful list payloads', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ code: 'forbidden', message: 'Denied', requestId: 'req-1' }, false, 403));
    vi.stubGlobal('fetch', fetch);
    await expect(adminIdentityApi.listDefinitions()).rejects.toEqual(expect.objectContaining({ status: 403, code: 'forbidden', requestId: 'req-1' } satisfies Partial<AdminIdentityApiError>));

    fetch.mockResolvedValueOnce(response({ code: 'forbidden', requestId: 'req-1' }, false, 403));
    await expect(adminIdentityApi.listDefinitions()).rejects.toBeInstanceOf(AdminIdentityApiProtocolError);
    fetch.mockResolvedValueOnce(response({ items: [], extra: true }));
    await expect(adminIdentityApi.listDefinitions()).rejects.toBeInstanceOf(AdminIdentityApiProtocolError);
  });
});
