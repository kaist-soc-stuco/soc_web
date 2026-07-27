import type { AdminFeeListResponse, AdminFeeListItem, AppErrorResponse, FeeStatus } from '@soc/contracts';

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
export const isAdminFeeListItem = (value: unknown): value is AdminFeeListItem => exact(value, ['id', 'kaistUid', 'studentOrEmployeeNumber', 'nameKr', 'nameEn', 'feeStatus', 'updatedAt']) && string(value.id) && nullableString(value.kaistUid) && nullableString(value.studentOrEmployeeNumber) && nullableString(value.nameKr) && nullableString(value.nameEn) && feeStatus(value.feeStatus) && string(value.updatedAt);
export const isAdminFeeListResponse = (value: unknown): value is AdminFeeListResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every(isAdminFeeListItem);
const decode = <T>(payload: unknown, predicate: (value: unknown) => value is T): T => { if (!predicate(payload)) throw new FeeApiProtocolError(); return payload; };
const isErrorEnvelope = (value: unknown): value is AppErrorResponse => exact(value, ['code', 'message']) && string(value.code) && string(value.message);
async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', signal, headers: { Accept: 'application/json' } });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) { const envelope = isErrorEnvelope(payload) ? payload : undefined; throw new FeeApiError(response.status, envelope?.code, envelope?.message); }
  return payload;
}
export const feeApi = { listCurrent: async (signal?: AbortSignal) => decode(await request('/admin/fees', signal), isAdminFeeListResponse) };
