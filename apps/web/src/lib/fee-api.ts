import type { AdminFeeListResponse, AdminFeeListItem, AdminFeeUpdateResponse, AppErrorResponse, FeeStatus } from '@soc/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

export class FeeApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = 'FeeApiError';
  }
}
export class FeeApiProtocolError extends Error {
  constructor(message = 'The server returned an invalid JSON response.') { super(message); this.name = 'FeeApiProtocolError'; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const string = (value: unknown): value is string => typeof value === 'string';
const nullableString = (value: unknown): value is string | null => value === null || string(value);
const feeStatus = (value: unknown): value is FeeStatus => value === 'UNKNOWN' || value === 'UNPAID' || value === 'PAID';
export const isAdminFeeListItem = (value: unknown): value is AdminFeeListItem => exact(value, ['id', 'kaistUid', 'studentOrEmployeeKind', 'studentOrEmployeeNumber', 'nameKr', 'nameEn', 'feeStatus', 'updatedAt']) && string(value.id) && nullableString(value.kaistUid) && (value.studentOrEmployeeKind === null || value.studentOrEmployeeKind === 'STUDENT' || value.studentOrEmployeeKind === 'EMPLOYEE') && nullableString(value.studentOrEmployeeNumber) && nullableString(value.nameKr) && nullableString(value.nameEn) && feeStatus(value.feeStatus) && string(value.updatedAt);
export const isAdminFeeListResponse = (value: unknown): value is AdminFeeListResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every(isAdminFeeListItem);
const decode = <T>(payload: unknown, predicate: (value: unknown) => value is T): T => { if (!predicate(payload)) throw new FeeApiProtocolError(); return payload; };
const isErrorEnvelope = (value: unknown): value is AppErrorResponse => exact(value, ['code', 'message']) && string(value.code) && string(value.message);
async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) { const envelope = isErrorEnvelope(payload) ? payload : undefined; throw new FeeApiError(response.status, envelope?.code, envelope?.message); }
  return payload;
}
const isAdminFeeUpdateResponse = (value: unknown): value is AdminFeeUpdateResponse =>
  exact(value, ['userId', 'feeStatus', 'updatedAt']) && string(value.userId) && feeStatus(value.feeStatus) && string(value.updatedAt);

export const feeApi = {
  listCurrent: async (signal?: AbortSignal) => decode(await request('/users/admin/fees', { signal }), isAdminFeeListResponse),
  update: async (userId: string, feeStatus: FeeStatus, reasonCode: string) =>
    decode(await request(`/users/admin/${encodeURIComponent(userId)}/fee`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({ feeStatus, reasonCode }),
    }), isAdminFeeUpdateResponse),
};
