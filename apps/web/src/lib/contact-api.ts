import type { AdminContactListResponse, AppErrorResponse, ChatPageResponse, ChatMessageRequest, ChatMessageResult, ContactDto, CreateContactRequest, DeleteContactRequest, MailCancelRequest, MailCreateRequest, MailCreateResult, MailGetRequest, MailPreviewRequest, MailPreviewResult, PatchContactRequest } from '@soc/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is RecordValue => object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const string = (value: unknown): value is string => typeof value === 'string';
const nullableString = (value: unknown) => value === null || string(value);

export class ContactApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) { super(message ?? `HTTP ${status}`); this.name = 'ContactApiError'; }
}
export class ContactApiProtocolError extends Error { constructor() { super('The server returned an invalid JSON response.'); this.name = 'ContactApiProtocolError'; } }

const isError = (value: unknown): value is AppErrorResponse => object(value) && string(value.code) && string(value.message) && string(value.requestId);
const isContact = (value: unknown): value is ContactDto => exact(value, ['id', 'projection', 'name', 'email', 'phone', 'affiliation', 'note', 'kaistUid', 'year', 'role', 'createdAt', 'updatedAt', 'deletedAt', 'retentionDeadlineAt', 'holdUntil']) && string(value.id) && (value.projection === 'MASKED' || value.projection === 'FULL') && string(value.name) && nullableString(value.email) && nullableString(value.phone) && nullableString(value.affiliation) && nullableString(value.note) && nullableString(value.kaistUid) && nullableString(value.year) && nullableString(value.role) && string(value.createdAt) && string(value.updatedAt) && nullableString(value.deletedAt) && string(value.retentionDeadlineAt) && nullableString(value.holdUntil) && (value.projection === 'FULL' || value.note === null);
const isList = (value: unknown): value is AdminContactListResponse => exact(value, ['items', 'nextCursor']) && Array.isArray(value.items) && value.items.every(isContact) && nullableString(value.nextCursor);
const isContactResponse = (value: unknown): value is { contact: ContactDto } => exact(value, ['contact']) && isContact(value.contact);
const isDisabled = (value: unknown): value is { ok: false; code: 'feature_disabled'; status: 503 } => exact(value, ['ok', 'code', 'status']) && value.ok === false && value.code === 'feature_disabled' && value.status === 503;
const isChatPage = (value: unknown): value is ChatPageResponse => exact(value, ['kind', 'externalUrl', 'notice']) && value.kind === 'EXTERNAL_LINK_NOTICE' && string(value.externalUrl) && string(value.notice) || exact(value, ['kind', 'notice']) && value.kind === 'INTERNAL_CHAT' && string(value.notice);
const isMailPreview = (value: unknown): value is MailPreviewResult => isDisabled(value) || exact(value, ['ok', 'recipients', 'subject', 'body']) && value.ok === true && Number.isInteger(value.recipients) && string(value.subject) && string(value.body);
const isMailCreate = (value: unknown): value is MailCreateResult => isDisabled(value) || exact(value, ['ok', 'id', 'status']) && value.ok === true && string(value.id) && value.status === 'SENT';
const isChatMessage = (value: unknown): value is ChatMessageResult => isDisabled(value) || exact(value, ['ok', 'reply']) && value.ok === true && string(value.reply);

async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method, signal, credentials: 'include', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) { const error = isError(payload) ? payload : undefined; throw new ContactApiError(response.status, error?.code, error?.message); }
  return payload;
}
const decode = <T>(value: unknown, predicate: (input: unknown) => input is T): T => { if (!predicate(value)) throw new ContactApiProtocolError(); return value; };

export const contactApi = {
  list: (projection: 'MASKED' | 'FULL' = 'MASKED', signal?: AbortSignal) => request(`/admin/contacts?projection=${projection}`, 'GET', undefined, signal).then((value) => decode(value, isList)),
  create: (input: CreateContactRequest) => request('/admin/contacts', 'POST', input).then((value) => decode(value, isContactResponse).contact),
  patch: (id: string, input: PatchContactRequest) => request(`/admin/contacts/${encodeURIComponent(id)}`, 'PATCH', input).then((value) => decode(value, isContactResponse).contact),
  remove: (id: string, input: DeleteContactRequest) => request(`/admin/contacts/${encodeURIComponent(id)}`, 'DELETE', input),
  mailPreview: (input: MailPreviewRequest) => request('/admin/mail/preview', 'POST', input).then((value) => decode(value, isMailPreview)),
  mailCreate: (input: MailCreateRequest) => request('/admin/mail', 'POST', input).then((value) => decode(value, isMailCreate)),
  mailGet: (input: MailGetRequest) => request(`/admin/mail/${encodeURIComponent(input.id)}`).then((value) => decode(value, isDisabled)),
  mailCancel: (id: string, input: MailCancelRequest) => request(`/admin/mail/${encodeURIComponent(id)}/cancel`, 'POST', input).then((value) => decode(value, isDisabled)),
  chatPage: (signal?: AbortSignal) => request('/chat', 'GET', undefined, signal).then((value) => decode(value, isChatPage)),
  chatMessage: (input: ChatMessageRequest) => request('/chat/messages', 'POST', input).then((value) => decode(value, isChatMessage)),
};
