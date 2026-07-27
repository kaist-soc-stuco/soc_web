import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeeApiError, FeeApiProtocolError, feeApi } from '../lib/fee-api';

afterEach(() => vi.restoreAllMocks());
const item = { id: 'u1', kaistUid: 'uid', studentOrEmployeeNumber: '20260001', nameKr: '홍길동', nameEn: 'Hong', feeStatus: 'PAID', updatedAt: '2026-07-27T00:00:00.000Z' };
describe('feeApi', () => {
  it('loads the credentialed current-fee endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [item] }), { status: 200 }));
    await expect(feeApi.listCurrent()).resolves.toEqual({ items: [item] });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/fees', expect.objectContaining({ credentials: 'include' }));
  });
  it('maps API errors and rejects malformed payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'forbidden', message: 'no' }), { status: 403 }));
    await expect(feeApi.listCurrent()).rejects.toBeInstanceOf(FeeApiError);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [{ ...item, extra: true }] }), { status: 200 }));
    await expect(feeApi.listCurrent()).rejects.toBeInstanceOf(FeeApiProtocolError);
  });
});
