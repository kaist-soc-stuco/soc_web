import type { PatchMeRequest, UserMeResponse } from '@soc/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isGrant = (value: unknown) => isObject(value)
  && typeof value.id === 'string'
  && typeof value.permission === 'string'
  && ['GLOBAL', 'BOARD', 'EVENT', 'SURVEY'].includes(String(value.scope))
  && nullableString(value.scopeId)
  && typeof value.activatedFrom === 'string'
  && nullableString(value.expiresAt);
const isProfile = (value: unknown): value is UserMeResponse => isObject(value)
  && ['UNKNOWN', 'UNPAID', 'PAID'].includes(String(value.feeStatus))
  && typeof value.id === 'string'
  && nullableString(value.kaistUid)
  && nullableString(value.studentOrEmployeeNumber)
  && nullableString(value.nameKr)
  && nullableString(value.nameEn)
  && typeof value.majorMask === 'number'
  && nullableString(value.privacyConsentAt)
  && nullableString(value.userEmail)
  && nullableString(value.userMobile)
  && Array.isArray(value.grants)
  && value.grants.every(isGrant);

export class ProfileApiError extends Error {
  readonly name = 'ProfileApiError';
  constructor(public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(code);
  }
}

async function request(method: 'GET' | 'PATCH', body?: PatchMeRequest, signal?: AbortSignal): Promise<UserMeResponse> {
  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isObject(payload) ? payload : {};
    throw new ProfileApiError(response.status, typeof error.code === 'string' ? error.code : 'profile_request_failed', typeof error.requestId === 'string' ? error.requestId : undefined);
  }
  if (!isProfile(payload)) throw new ProfileApiError(response.status, 'invalid_profile_response');
  return payload;
}

export const profileApi = {
  get: (signal?: AbortSignal) => request('GET', undefined, signal),
  update: (input: PatchMeRequest) => request('PATCH', input),
};
