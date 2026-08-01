import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeeApiError, FeeApiProtocolError, feeApi } from '../lib/fee-api';

afterEach(() => vi.restoreAllMocks());
const item = { id: 'u1', studentOrEmployeeKind: 'STUDENT', studentOrEmployeeNumber: '20260001', nameKr: '홍길동', nameEn: 'Hong', feeStatus: 'PAID', updatedAt: '2026-07-27T00:00:00.000Z' };
describe('feeApi', () => {
  it('loads the credentialed current-fee endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [item], nextCursor: 'next' }), { status: 200 }));
    await expect(feeApi.listCurrent({ name: '홍길동', limit: 25 })).resolves.toEqual({ items: [item], nextCursor: 'next' });
    expect(fetchMock).toHaveBeenCalledWith('/api/users/admin/fees?limit=25&name=%ED%99%8D%EA%B8%B8%EB%8F%99', expect.objectContaining({ credentials: 'include' }));
  });
  it('updates an individual fee status with audit metadata and a request id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const response = { userId: 'u1', feeStatus: 'UNPAID', updatedAt: '2026-07-28T00:00:00.000Z' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    await expect(feeApi.update('u1', 'UNPAID', 'PAYMENT_REVIEWED', '입금 확인')).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('/api/users/admin/u1/fee', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      headers: expect.objectContaining({ 'Content-Type': 'application/json', 'X-Request-Id': '00000000-0000-4000-8000-000000000001' }),
      body: JSON.stringify({ feeStatus: 'UNPAID', reasonCode: 'PAYMENT_REVIEWED', operatorNote: '입금 확인' }),
    }));
  });
  it('maps API errors and rejects malformed payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'forbidden', message: 'no' }), { status: 403 }));
    await expect(feeApi.listCurrent()).rejects.toBeInstanceOf(FeeApiError);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [{ ...item, extra: true }], nextCursor: null }), { status: 200 }));
    await expect(feeApi.listCurrent()).rejects.toBeInstanceOf(FeeApiProtocolError);
  });
});
