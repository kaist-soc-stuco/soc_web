import type {
  AdminUserGetResponse,
  AdminUserListResponse,
  EffectivePermissionGrant,
  PermissionAuditListResponse,
  PermissionChangeRequestResponse,
  PermissionDefinitionListResponse,
  PermissionGrantActivateRequest,
  PermissionGrantApproveRequest,
  PermissionGrantRequest,
  PermissionGrantRequestResponse,
  PermissionRequestQueueListResponse,
  UserMeResponse,
} from '@soc/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const string = (value: unknown): value is string => typeof value === 'string';
const nullableString = (value: unknown): value is string | null => value === null || string(value);
const scope = (value: unknown): value is EffectivePermissionGrant['scope'] => value === 'GLOBAL' || value === 'BOARD' || value === 'EVENT' || value === 'SURVEY';
const action = (value: unknown): value is PermissionGrantRequest['action'] => value === 'GRANT' || value === 'REVOKE';
const status = (value: unknown): value is PermissionChangeRequestResponse['status'] => ['PENDING', 'APPROVED', 'ACTIVATED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(value as string);

export class AdminIdentityApiError extends Error {
  readonly name = 'AdminIdentityApiError';
  constructor(public readonly status: number, public readonly code: string, public readonly requestId: string) {
    super('Admin API request failed');
  }
}
export class AdminIdentityApiProtocolError extends Error {
  readonly name = 'AdminIdentityApiProtocolError';
  constructor() { super('The server returned an invalid admin API response.'); }
}

const isGrant = (value: unknown): value is EffectivePermissionGrant => exact(value, ['id', 'permission', 'scope', 'scopeId', 'activatedFrom', 'expiresAt'])
  && string(value.id) && string(value.permission) && scope(value.scope) && nullableString(value.scopeId)
  && string(value.activatedFrom) && nullableString(value.expiresAt);
const isCurrentUser = (value: unknown): value is UserMeResponse => exact(value, ['feeStatus', 'id', 'kaistUid', 'majorMask', 'nameEn', 'nameKr', 'privacyConsentAt', 'studentOrEmployeeNumber', 'userEmail', 'userMobile', 'grants'])
  && (value.feeStatus === 'UNKNOWN' || value.feeStatus === 'UNPAID' || value.feeStatus === 'PAID')
  && string(value.id) && nullableString(value.kaistUid) && typeof value.majorMask === 'number'
  && nullableString(value.nameEn) && nullableString(value.nameKr) && nullableString(value.privacyConsentAt)
  && nullableString(value.studentOrEmployeeNumber) && nullableString(value.userEmail) && nullableString(value.userMobile)
  && Array.isArray(value.grants) && value.grants.every(isGrant);
const isDefinitionList = (value: unknown): value is PermissionDefinitionListResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['key', 'description']) && string(item.key) && string(item.description));
const isChange = (value: unknown): value is PermissionChangeRequestResponse => exact(value, ['id', 'targetUserId', 'action', 'permission', 'scope', 'scopeId', 'status', 'requestedAt', 'approvedAt', 'activatedAt', 'expiresAt'])
  && string(value.id) && string(value.targetUserId) && action(value.action) && string(value.permission) && scope(value.scope) && nullableString(value.scopeId) && status(value.status)
  && string(value.requestedAt) && nullableString(value.approvedAt) && nullableString(value.activatedAt) && string(value.expiresAt);
const isQueue = (value: unknown): value is PermissionRequestQueueListResponse => exact(value, ['items', 'nextCursor']) && Array.isArray(value.items) && value.items.every(isChange) && nullableString(value.nextCursor);
const isRequestResponse = (value: unknown): value is PermissionGrantRequestResponse => exact(value, ['id', 'requestHash', 'status', 'requestedAt', 'expiresAt']) && string(value.id) && string(value.requestHash) && value.status === 'PENDING' && string(value.requestedAt) && string(value.expiresAt);
const isAudit = (value: unknown): value is PermissionAuditListResponse => exact(value, ['items', 'nextCursor']) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['id', 'actorUserId', 'action', 'recordId', 'changedFieldNames', 'correlationId', 'reasonCode', 'occurredAt']) && string(item.id) && nullableString(item.actorUserId) && string(item.action) && string(item.recordId) && Array.isArray(item.changedFieldNames) && item.changedFieldNames.every(string) && string(item.correlationId) && nullableString(item.reasonCode) && string(item.occurredAt)) && nullableString(value.nextCursor);
const isAdminUser = (value: unknown): value is AdminUserGetResponse => exact(value, ['id', 'kaistUid', 'studentOrEmployeeNumber', 'nameKr', 'nameEn', 'majorMask', 'privacyConsentAt', 'grants']) && string(value.id) && nullableString(value.kaistUid) && nullableString(value.studentOrEmployeeNumber) && nullableString(value.nameKr) && nullableString(value.nameEn) && typeof value.majorMask === 'number' && nullableString(value.privacyConsentAt) && Array.isArray(value.grants) && value.grants.every(isGrant);
const isAdminUserList = (value: unknown): value is AdminUserListResponse => exact(value, ['items', 'nextCursor']) && Array.isArray(value.items) && value.items.every(isAdminUser) && nullableString(value.nextCursor);

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (exact(payload, ['code', 'message', 'requestId']) && string(payload.code) && string(payload.message) && string(payload.requestId)) throw new AdminIdentityApiError(response.status, payload.code, payload.requestId);
    throw new AdminIdentityApiProtocolError();
  }
  return payload;
}
const decode = <T>(payload: unknown, predicate: (value: unknown) => value is T): T => { if (!predicate(payload)) throw new AdminIdentityApiProtocolError(); return payload; };
const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};
const post = (path: string, body: unknown) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const adminIdentityApi = {
  getCurrentUser: async () => {
    const user = decode(await request('/users/me'), isCurrentUser);
    return { grants: user.grants };
  },
  listUsers: async (values: { cursor?: string; limit?: number; name?: string; studentOrEmployeeNumber?: string }, signal?: AbortSignal) => decode(await request(`/users/admin${query(values)}`, { signal }), isAdminUserList),
  getUser: async (userId: string, signal?: AbortSignal) => decode(await request(`/users/admin/${encodeURIComponent(userId)}`, { signal }), isAdminUser),
  listDefinitions: async (signal?: AbortSignal) => decode(await request('/permissions/definitions', { signal }), isDefinitionList),
  listRequests: async (values: { stage: 'REQUESTED' | 'APPROVAL' | 'ACTIVATION'; cursor?: string; limit?: number }, signal?: AbortSignal) => decode(await request(`/permissions/requests${query(values)}`, { signal }), isQueue),
  requestGrant: async (body: PermissionGrantRequest) => decode(await post('/permissions/requests', body), isRequestResponse),
  approveRequest: async (requestId: string, body: PermissionGrantApproveRequest) => decode(await post(`/permissions/requests/${encodeURIComponent(requestId)}/approve`, body), isChange),
  activateRequest: async (requestId: string, body: PermissionGrantActivateRequest) => decode(await post(`/permissions/requests/${encodeURIComponent(requestId)}/activate`, body), isChange),
  listAudit: async (values: { cursor?: string; limit?: number }, signal?: AbortSignal) => decode(await request(`/permissions/audit${query(values)}`, { signal }), isAudit),
};
