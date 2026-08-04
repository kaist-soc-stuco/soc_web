import type { AddSurveyImageBlockMembershipRequest, AdminSurveyExactAggregate, AdminSurveyResponseDetail, AdminSurveyResponsePage, AppErrorResponse, ChangeSurveyImageBlockModeRequest, CompleteSurveyImageAssetV2Request, ContentLocale, ContentMatcherDto, CreateContentMatcherRequest, CreateSurveyRequest, ExportSurveyRequest, GetMySurveyResponseResponse, InitiateSurveyImageAssetV2Request, ListContentMatchersResponse, LoginSessionResponse, MaterializeSurveyEventRequest, MaterializeSurveyEventResponse, MoveSurveyImageBlockMembershipRequest, MySurveyResponsesResponse, PatchSurveyRequest, PublishSurveyResponse, RelatedContentCard, RelatedContentResponse, RemoveSurveyImageBlockMembershipRequest, ReplaceSurveyDefinitionRequest, ReplaceSurveyDefinitionResponse, ReviewAdminSurveyResponseRequest, SubmitSurveyResponseRequest, SurveyDto, SurveyImageAssetInitiatedV2, SurveyImageBlockMembershipPage, SurveyImageBlockModeMutationResponse, SurveyImageBlockMutationResponse, SurveyListResponse, SurveyResponseAnswerDto, SurveyResponseDto, SurveyReviewQueueResponse } from '@soc/contracts';

export type RestrictedPattern = { allowed: ReadonlySet<string>; minimum: number; maximum: number };
export type SubmitSurveyResult = { status: 'ACCEPTED' } | { response: SurveyResponseDto };
export type CompletedSurveyImageAssetV2 = { id: string; contentType: string; byteSize: number; width: number; height: number; status: 'INITIATED' | 'COMPLETED' | 'DELETED' };

export function parseRestrictedCharacterPattern(pattern: unknown): RestrictedPattern | null {
  if (typeof pattern !== 'string' || pattern.length > 256) return null;
  const match = /^\^\[([A-Za-z0-9 .,_@+\-]+)\](?:\{(\d+)(?:,(\d+))?\}|([+*?]))\$$/.exec(pattern);
  if (!match) return null;
  const [, characters, exact, maximum, shorthand] = match;
  const allowed = new Set<string>();
  for (let index = 0; index < characters.length;) {
    const character = characters[index]!;
    if (character === '-') { if (index !== 0 && index !== characters.length - 1) return null; allowed.add(character); index += 1; }
    else if (characters[index + 1] === '-') { if (index + 2 >= characters.length || characters[index + 2] === '-') return null; const end = characters.charCodeAt(index + 2); if (character.charCodeAt(0) > end || end > 0x7f) return null; for (let code = character.charCodeAt(0); code <= end; code += 1) allowed.add(String.fromCharCode(code)); index += 3; }
    else { allowed.add(character); index += 1; }
  }
  const minimum = exact ? Number(exact) : shorthand === '+' ? 1 : 0;
  const limit = exact && maximum === undefined ? Number(exact) : maximum ? Number(maximum) : shorthand === '?' ? 1 : 8_192;
  return Number.isSafeInteger(minimum) && Number.isSafeInteger(limit) && minimum <= limit && limit <= 8_192 ? { allowed, minimum, maximum: limit } : null;
}
export function matchesRestrictedCharacterPattern(pattern: string, value: string): boolean | null { const parsed = parseRestrictedCharacterPattern(pattern); return parsed && [...value].every((character) => parsed.allowed.has(character)) && value.length >= parsed.minimum && value.length <= parsed.maximum; }

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
export class SurveyApiError extends Error { constructor(public readonly status: number, public readonly code?: string, message?: string, public readonly requestId?: string) { super(message ?? `HTTP ${status}`); this.name = 'SurveyApiError'; } }
export class SurveyApiProtocolError extends Error { constructor(message = 'The server returned an invalid JSON response.') { super(message); this.name = 'SurveyApiProtocolError'; } }
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is RecordValue => object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const string = (value: unknown): value is string => typeof value === 'string';
const surveyImageSrc = (value: unknown): value is string => string(value) && /^\/api\/surveys\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const nullable = (value: unknown, predicate: (input: unknown) => boolean) => value === null || predicate(value);
const enumValue = <T extends string>(values: readonly T[]) => (value: unknown): value is T => string(value) && values.includes(value as T);
const locale = enumValue(['ko', 'en'] as const);
const surveyState = enumValue(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ARCHIVED'] as const);
const responseState = enumValue(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'] as const);
const reviewableResponseState = enumValue(['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'] as const);
const questionType = enumValue(['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE'] as const);
const isLocalized = (value: unknown) => exact(value, ['value', 'translationUnavailable']) && nullable(value.value, string) && typeof value.translationUnavailable === 'boolean';
const isAnswer = (value: unknown): value is SurveyResponseAnswerDto => exact(value, ['questionId', 'textValue']) && string(value.questionId) && string(value.textValue)
  || exact(value, ['questionId', 'numberValue']) && string(value.questionId) && typeof value.numberValue === 'number'
  || exact(value, ['questionId', 'dateValue']) && string(value.questionId) && string(value.dateValue)
  || exact(value, ['questionId', 'choiceOptionIds']) && string(value.questionId) && Array.isArray(value.choiceOptionIds) && value.choiceOptionIds.every(string);
const isResponse = (value: unknown): value is SurveyResponseDto => exact(value, ['id', 'state', 'answers', 'submittedAt', 'reviewedAt', 'reviewReason', 'phonePresent', 'maskedPhone']) && string(value.id) && responseState(value.state) && Array.isArray(value.answers) && value.answers.every(isAnswer) && nullable(value.submittedAt, string) && nullable(value.reviewedAt, string) && nullable(value.reviewReason, string) && typeof value.phonePresent === 'boolean' && nullable(value.maskedPhone, string);
const isQuestion = (value: unknown) => {
  const base = ['id', 'ordinal', 'prompt', 'helpText', 'type', 'required', 'validationRegex', 'numberMin', 'numberMax', 'dateMin', 'dateMax', 'choices'];
  if (!exact(value, base) || !string(value.id) || !Number.isInteger(value.ordinal) || !isLocalized(value.prompt) || !nullable(value.helpText, isLocalized) || !questionType(value.type) || typeof value.required !== 'boolean' || !Array.isArray(value.choices)) return false;
  const choices = value.choices.every((choice) => exact(choice, ['id', 'ordinal', 'value']) && string(choice.id) && Number.isInteger(choice.ordinal) && isLocalized(choice.value));
  if (!choices) return false;
  if (value.type === 'SHORT_TEXT' || value.type === 'LONG_TEXT') return nullable(value.validationRegex, string) && value.numberMin === null && value.numberMax === null && value.dateMin === null && value.dateMax === null && value.choices.length === 0;
  if (value.type === 'SINGLE_CHOICE' || value.type === 'MULTIPLE_CHOICE') return value.validationRegex === null && value.numberMin === null && value.numberMax === null && value.dateMin === null && value.dateMax === null;
  if (value.type === 'NUMBER') return value.validationRegex === null && nullable(value.numberMin, (input) => typeof input === 'number') && nullable(value.numberMax, (input) => typeof input === 'number') && value.dateMin === null && value.dateMax === null && value.choices.length === 0;
  return value.validationRegex === null && value.numberMin === null && value.numberMax === null && nullable(value.dateMin, string) && nullable(value.dateMax, string) && value.choices.length === 0;
};
const isMembership = (value: unknown) => exact(value, ['id', 'asset']) && string(value.id) && object(value.asset) && exact(value.asset, ['id', 'src', 'contentType', 'byteSize', 'width', 'height']) && string(value.asset.id) && surveyImageSrc(value.asset.src) && string(value.asset.contentType) && Number.isInteger(value.asset.byteSize) && Number.isInteger(value.asset.width) && Number.isInteger(value.asset.height);
const isItem = (value: unknown) => object(value) && string(value.id) && Number.isInteger(value.ordinal) && (
  value.kind === 'QUESTION' && exact(value, ['id', 'ordinal', 'kind', 'question']) && isQuestion(value.question)
  || value.kind === 'DESCRIPTION' && exact(value, ['id', 'ordinal', 'kind', 'body']) && isLocalized(value.body)
  || value.kind === 'IMAGE_BLOCK' && exact(value, ['id', 'ordinal', 'kind', 'mode', 'membershipCounts']) && (value.mode === 'SHARED' || value.mode === 'LOCALIZED') && object(value.membershipCounts) && exact(value.membershipCounts, ['shared', 'ko', 'en']) && Object.values(value.membershipCounts).every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0)
);
const isSurvey = (value: unknown): value is SurveyDto => object(value)
  && ['id', 'revision', 'definitionVersion', 'locale', 'requestedLocale', 'effectiveContentLocale', 'onlyForKoreanSpeaker', 'title', 'description', 'state', 'guestAllowed', 'phoneRequired', 'feeRestriction', 'cap', 'opensAt', 'closesAt', 'editDeadlineAt', 'responseRetentionDays', 'sections', 'updatedAt'].every((key) => key in value)
  && Object.keys(value).every((key) => ['id', 'revision', 'definitionVersion', 'locale', 'requestedLocale', 'effectiveContentLocale', 'onlyForKoreanSpeaker', 'title', 'description', 'state', 'guestAllowed', 'phoneRequired', 'feeRestriction', 'cap', 'opensAt', 'closesAt', 'editDeadlineAt', 'responseRetentionDays', 'sections', 'updatedAt'].includes(key))
  && string(value.id) && Number.isInteger(value.revision) && typeof value.definitionVersion === 'number' && Number.isInteger(value.definitionVersion) && value.definitionVersion >= 1 && locale(value.locale) && locale(value.requestedLocale) && locale(value.effectiveContentLocale) && typeof value.onlyForKoreanSpeaker === 'boolean' && isLocalized(value.title) && nullable(value.description, isLocalized) && surveyState(value.state) && typeof value.guestAllowed === 'boolean' && typeof value.phoneRequired === 'boolean' && (value.feeRestriction === 'ANY' || value.feeRestriction === 'PAID_ONLY') && nullable(value.cap, (input) => typeof input === 'number') && nullable(value.opensAt, string) && nullable(value.closesAt, string) && nullable(value.editDeadlineAt, string) && Number.isInteger(value.responseRetentionDays) && Array.isArray(value.sections) && value.sections.every((section) => exact(section, ['id', 'ordinal', 'title', 'items']) && string(section.id) && Number.isInteger(section.ordinal) && isLocalized(section.title) && Array.isArray(section.items) && section.items.every(isItem)) && nullable(value.updatedAt, string);
const isMembershipPage = (value: unknown): value is SurveyImageBlockMembershipPage => exact(value, ['items', 'nextCursor', 'membershipCount', 'definitionVersion', 'requestedLocale', 'effectiveContentLocale']) && Array.isArray(value.items) && value.items.every(isMembership) && nullable(value.nextCursor, string) && typeof value.membershipCount === 'number' && Number.isInteger(value.membershipCount) && value.membershipCount >= 0 && typeof value.definitionVersion === 'number' && Number.isInteger(value.definitionVersion) && locale(value.requestedLocale) && locale(value.effectiveContentLocale);
const isMembershipMutation = (value: unknown): value is SurveyImageBlockMutationResponse => exact(value, ['definitionVersion', 'membership', 'membershipCount']) && typeof value.definitionVersion === 'number' && Number.isInteger(value.definitionVersion) && value.definitionVersion > 0 && nullable(value.membership, isMembership) && typeof value.membershipCount === 'number' && Number.isInteger(value.membershipCount) && value.membershipCount >= 0;
const isModeMutation = (value: unknown): value is SurveyImageBlockModeMutationResponse => exact(value, ['definitionVersion', 'mode', 'membershipCounts']) && typeof value.definitionVersion === 'number' && Number.isInteger(value.definitionVersion) && value.definitionVersion > 0 && (value.mode === 'SHARED' || value.mode === 'LOCALIZED') && object(value.membershipCounts) && exact(value.membershipCounts, ['shared', 'ko', 'en']) && Object.values(value.membershipCounts).every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0);
const isInitiatedImage = (value: unknown): value is SurveyImageAssetInitiatedV2 => exact(value, ['image', 'uploadUrl', 'uploadHeaders']) && object(value.image) && exact(value.image, ['id', 'contentType', 'byteSize', 'width', 'height', 'status']) && string(value.image.id) && string(value.image.contentType) && Number.isInteger(value.image.byteSize) && value.image.width === null && value.image.height === null && (value.image.status === 'INITIATED' || value.image.status === 'COMPLETED' || value.image.status === 'DELETED') && string(value.uploadUrl) && object(value.uploadHeaders) && Object.values(value.uploadHeaders).every(string);
const isCompletedImage = (value: unknown): value is CompletedSurveyImageAssetV2 => exact(value, ['id', 'contentType', 'byteSize', 'width', 'height', 'status']) && string(value.id) && string(value.contentType) && Number.isInteger(value.byteSize) && Number.isInteger(value.width) && Number.isInteger(value.height) && (value.status === 'INITIATED' || value.status === 'COMPLETED' || value.status === 'DELETED');
const decode = <T>(payload: unknown, predicate: (value: unknown) => value is T): T => { if (!predicate(payload)) throw new SurveyApiProtocolError(); return payload; };
function isErrorEnvelope(value: unknown): value is AppErrorResponse { return exact(value, ['code', 'message', 'requestId']) && string(value.code) && string(value.message) && string(value.requestId); }
async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> { const response = await fetch(`${apiBaseUrl}${path}`, { method, signal, credentials: 'include', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); const payload: unknown = await response.json().catch(() => undefined); if (!response.ok) { const envelope = isErrorEnvelope(payload) ? payload : undefined; throw new SurveyApiError(response.status, envelope?.code, envelope?.message, envelope?.requestId); } return payload; }
const isList = (value: unknown): value is SurveyListResponse => exact(value, ['locale', 'items']) && locale(value.locale) && Array.isArray(value.items) && value.items.every(isSurvey);
const isReviewQueue = (value: unknown): value is SurveyReviewQueueResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['surveyId', 'title', 'state', 'responseCount', 'latestResponseAt']) && string(item.surveyId) && isLocalized(item.title) && surveyState(item.state) && typeof item.responseCount === 'number' && Number.isInteger(item.responseCount) && item.responseCount > 0 && nullable(item.latestResponseAt, string));
const isSession = (value: unknown): value is LoginSessionResponse => object(value) && Object.keys(value).every((key) => ['authenticated', 'canUsePersistentFeatures', 'requiresConsent', 'storageMode', 'userId'].includes(key)) && ['authenticated', 'canUsePersistentFeatures', 'requiresConsent', 'storageMode'].every((key) => key in value) && typeof value.authenticated === 'boolean' && typeof value.canUsePersistentFeatures === 'boolean' && typeof value.requiresConsent === 'boolean' && (value.storageMode === null || value.storageMode === 'temporary' || value.storageMode === 'persisted') && (!('userId' in value) || string(value.userId));
const isMine = (value: unknown): value is GetMySurveyResponseResponse => exact(value, ['response']) && nullable(value.response, isResponse);
const isExactAggregate = (value: unknown): value is AdminSurveyExactAggregate => exact(value, ['surveyId', 'locale', 'revisions']) && string(value.surveyId) && locale(value.locale) && Array.isArray(value.revisions) && value.revisions.every((revision) => exact(revision, ['surveyRevisionId', 'revision', 'responseCount', 'questions']) && string(revision.surveyRevisionId) && Number.isInteger(revision.revision) && typeof revision.responseCount === 'number' && Number.isInteger(revision.responseCount) && revision.responseCount >= 0 && Array.isArray(revision.questions) && revision.questions.every((question) => exact(question, ['questionId', 'prompt', 'responseCount', 'choices']) && string(question.questionId) && isLocalized(question.prompt) && typeof question.responseCount === 'number' && Number.isInteger(question.responseCount) && question.responseCount >= 0 && Array.isArray(question.choices) && question.choices.every((choice) => exact(choice, ['choiceOptionId', 'label', 'count']) && string(choice.choiceOptionId) && isLocalized(choice.label) && typeof choice.count === 'number' && Number.isInteger(choice.count) && choice.count >= 0)));
const isResponsePage = (value: unknown): value is AdminSurveyResponsePage => exact(value, ['surveyId', 'locale', 'state', 'limit', 'matchingCount', 'items', 'nextCursor']) && string(value.surveyId) && locale(value.locale) && reviewableResponseState(value.state) && typeof value.limit === 'number' && Number.isInteger(value.limit) && typeof value.matchingCount === 'number' && Number.isInteger(value.matchingCount) && nullable(value.nextCursor, string) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['responseId', 'surveyId', 'surveyRevisionId', 'revision', 'state', 'submittedAt', 'reviewedAt']) && string(item.responseId) && item.surveyId === value.surveyId && string(item.surveyRevisionId) && Number.isInteger(item.revision) && item.state === value.state && reviewableResponseState(item.state) && string(item.submittedAt) && nullable(item.reviewedAt, string));
const isResponseDetail = (value: unknown): value is AdminSurveyResponseDetail => exact(value, ['responseId', 'surveyId', 'surveyRevisionId', 'revision', 'locale', 'state', 'submittedAt', 'reviewedAt', 'reviewReason', 'answers']) && string(value.responseId) && string(value.surveyId) && string(value.surveyRevisionId) && Number.isInteger(value.revision) && locale(value.locale) && reviewableResponseState(value.state) && string(value.submittedAt) && nullable(value.reviewedAt, string) && nullable(value.reviewReason, string) && Array.isArray(value.answers) && value.answers.every((answer) => exact(answer, ['questionId', 'prompt', 'value']) && string(answer.questionId) && isLocalized(answer.prompt) && object(answer.value) && ((exact(answer.value, ['kind', 'textValue']) && answer.value.kind === 'text' && string(answer.value.textValue)) || (exact(answer.value, ['kind', 'numberValue']) && answer.value.kind === 'number' && typeof answer.value.numberValue === 'number') || (exact(answer.value, ['kind', 'dateValue']) && answer.value.kind === 'date' && string(answer.value.dateValue)) || (exact(answer.value, ['kind', 'choices']) && answer.value.kind === 'choices' && Array.isArray(answer.value.choices) && answer.value.choices.every((choice) => exact(choice, ['choiceOptionId', 'label']) && string(choice.choiceOptionId) && isLocalized(choice.label)))));
const isMyResponses = (value: unknown): value is MySurveyResponsesResponse => exact(value, ['locale', 'items']) && locale(value.locale) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['survey', 'response']) && isSurvey(item.survey) && isResponse(item.response));
const relationType = enumValue(['ANNOUNCEMENT', 'SCHEDULE', 'SURVEY_PERIOD'] as const);
const syncMode = enumValue(['NONE', 'SURVEY_TO_EVENT'] as const);
const isMatcher = (value: unknown): value is ContentMatcherDto => exact(value, ['id', 'articleId', 'eventId', 'surveyId', 'relationType', 'syncMode', 'createdByUserId', 'createdAt', 'updatedByUserId', 'updatedAt', 'synchronizedAt'])
  && string(value.id) && nullable(value.articleId, string) && nullable(value.eventId, string) && nullable(value.surveyId, string)
  && [value.articleId, value.eventId, value.surveyId].filter((item) => item !== null).length === 2
  && relationType(value.relationType) && syncMode(value.syncMode) && string(value.createdByUserId) && string(value.createdAt)
  && string(value.updatedByUserId) && string(value.updatedAt) && nullable(value.synchronizedAt, string);
const isMatcherList = (value: unknown): value is ListContentMatchersResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every(isMatcher);
const isRelatedCard = (value: unknown): value is RelatedContentCard => object(value) && string(value.id) && string(value.title) && string(value.href) && relationType(value.relationType)
  && (value.kind === 'ARTICLE' && exact(value, ['kind', 'id', 'title', 'href', 'relationType'])
    || value.kind === 'EVENT' && exact(value, ['kind', 'id', 'title', 'href', 'relationType', 'startsAt']) && string(value.startsAt)
    || value.kind === 'SURVEY' && exact(value, ['kind', 'id', 'title', 'href', 'relationType', 'opensAt', 'closesAt']) && nullable(value.opensAt, string) && nullable(value.closesAt, string));
const isRelated = (value: unknown): value is RelatedContentResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every(isRelatedCard);

export const surveyApi = {
  list: async (signal?: AbortSignal, selectedLocale?: ContentLocale) => decode(await request(`/surveys${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isList),
  listAdmin: async (signal?: AbortSignal, selectedLocale?: ContentLocale) => decode(await request(`/admin/surveys${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isList),
  reviewQueue: async (signal?: AbortSignal, selectedLocale?: ContentLocale) => decode(await request(`/admin/surveys/review-queue${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isReviewQueue),
  session: async (signal?: AbortSignal) => decode(await request('/auth/session', 'GET', undefined, signal), isSession),
  get: async (id: string, selectedLocale?: ContentLocale, signal?: AbortSignal) => decode(await request(`/surveys/${id}${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isSurvey),
  getAdmin: async (id: string, selectedLocale?: ContentLocale, signal?: AbortSignal) => decode(await request(`/admin/surveys/${id}${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isSurvey),
  create: async (input: CreateSurveyRequest) => decode(await request('/admin/surveys', 'POST', input), isSurvey),
  patch: async (id: string, input: PatchSurveyRequest) => decode(await request(`/admin/surveys/${id}`, 'PATCH', input), isSurvey),
  replaceDefinition: async (id: string, input: ReplaceSurveyDefinitionRequest): Promise<ReplaceSurveyDefinitionResponse> => decode(await request(`/admin/surveys/${id}/definition`, 'PUT', input), (value): value is ReplaceSurveyDefinitionResponse => exact(value, ['survey']) && isSurvey(value.survey)),
  publish: async (id: string): Promise<PublishSurveyResponse> => decode(await request(`/admin/surveys/${id}/publish`, 'POST'), (value): value is PublishSurveyResponse => exact(value, ['survey']) && isSurvey(value.survey)),
  imageMemberships: async (surveyId: string, blockId: string, query: { set: 'SHARED' | 'KO' | 'EN'; limit?: number; cursor?: string }, signal?: AbortSignal) => {
    const params = new URLSearchParams({ set: query.set, ...(query.limit ? { limit: String(query.limit) } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) });
    return decode(await request(`/admin/surveys/${surveyId}/image-blocks/${blockId}/memberships?${params}`, 'GET', undefined, signal), isMembershipPage);
  },
  publicImageMemberships: async (surveyId: string, blockId: string, query: { set: 'SHARED' | 'KO' | 'EN'; locale: ContentLocale; limit?: number; cursor?: string }, signal?: AbortSignal) => {
    const params = new URLSearchParams({ set: query.set, locale: query.locale, ...(query.limit ? { limit: String(query.limit) } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) });
    return decode(await request(`/surveys/${surveyId}/image-blocks/${blockId}/memberships?${params}`, 'GET', undefined, signal), isMembershipPage);
  },
  addImageMembership: async (surveyId: string, blockId: string, input: AddSurveyImageBlockMembershipRequest) => decode(await request(`/admin/surveys/${surveyId}/image-blocks/${blockId}/memberships`, 'POST', input), isMembershipMutation),
  removeImageMembership: async (surveyId: string, blockId: string, membershipId: string, input: RemoveSurveyImageBlockMembershipRequest) => decode(await request(`/admin/surveys/${surveyId}/image-blocks/${blockId}/memberships/${membershipId}`, 'DELETE', input), isMembershipMutation),
  moveImageMembership: async (surveyId: string, blockId: string, membershipId: string, input: MoveSurveyImageBlockMembershipRequest) => decode(await request(`/admin/surveys/${surveyId}/image-blocks/${blockId}/memberships/${membershipId}`, 'PATCH', input), isMembershipMutation),
  changeImageBlockMode: async (surveyId: string, blockId: string, input: ChangeSurveyImageBlockModeRequest) => decode(await request(`/admin/surveys/${surveyId}/image-blocks/${blockId}/mode`, 'POST', input), isModeMutation),
  uploadSurveyImage: async (file: File): Promise<CompletedSurveyImageAssetV2> => {
    const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const initiated = decode(await request('/admin/survey-image-assets/v2/initiate', 'POST', { contentType: file.type, byteSize: file.size, checksumSha256 } satisfies InitiateSurveyImageAssetV2Request), isInitiatedImage);
    const upload = await fetch(initiated.uploadUrl, { method: 'PUT', headers: initiated.uploadHeaders, body: file });
    if (!upload.ok) throw new SurveyApiError(upload.status);
    return decode(await request(`/admin/survey-image-assets/${initiated.image.id}/v2/complete`, 'POST', { checksumSha256 } satisfies CompleteSurveyImageAssetV2Request), isCompletedImage);
  },
  submit: async (id: string, input: SubmitSurveyResponseRequest): Promise<SubmitSurveyResult> => decode(await request(`/surveys/${id}/responses`, 'POST', input), (value): value is SubmitSurveyResult => exact(value, ['status']) && value.status === 'ACCEPTED' || exact(value, ['response']) && isResponse(value.response)),
  mine: async (id: string, signal?: AbortSignal) => decode(await request(`/surveys/${id}/responses/me`, 'GET', undefined, signal), isMine),
  mineAll: async (selectedLocale: ContentLocale, signal?: AbortSignal) => decode(await request(`/surveys/responses/me?locale=${selectedLocale}`, 'GET', undefined, signal), isMyResponses),
  responses: async (id: string, query: { state: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED'; limit: number; cursor?: string; locale: ContentLocale }, signal?: AbortSignal) => {
    const params = new URLSearchParams({ state: query.state, limit: String(query.limit), locale: query.locale });
    if (query.cursor) params.set('cursor', query.cursor);
    return decode(await request(`/admin/surveys/${id}/responses?${params}`, 'GET', undefined, signal), isResponsePage);
  },
  response: async (surveyId: string, responseId: string, selectedLocale: ContentLocale, signal?: AbortSignal) => decode(await request(`/admin/surveys/${surveyId}/responses/${responseId}?locale=${selectedLocale}`, 'GET', undefined, signal), isResponseDetail),
  review: async (surveyId: string, responseId: string, selectedLocale: ContentLocale, input: ReviewAdminSurveyResponseRequest) => decode(await request(`/admin/surveys/${surveyId}/responses/${responseId}/review?locale=${selectedLocale}`, 'POST', input), isResponseDetail),
  aggregate: async (id: string, selectedLocale: ContentLocale, signal?: AbortSignal): Promise<AdminSurveyExactAggregate> => decode(await request(`/admin/surveys/${id}/aggregate/v2?locale=${selectedLocale}`, 'GET', undefined, signal), isExactAggregate),
  related: async (subject: { articleId?: string; eventId?: string; surveyId?: string }, selectedLocale: ContentLocale, signal?: AbortSignal) => {
    const query = new URLSearchParams([...Object.entries(subject).filter((entry): entry is [string, string] => entry[1] !== undefined), ['locale', selectedLocale]]);
    return decode(await request(`/surveys/content-relations?${query}`, 'GET', undefined, signal), isRelated);
  },
  materializeEvent: async (surveyId: string, input: MaterializeSurveyEventRequest) => decode(await request(`/admin/surveys/${surveyId}/materialize-event`, 'POST', input), (value): value is MaterializeSurveyEventResponse => exact(value, ['eventId', 'relation']) && string(value.eventId) && isMatcher(value.relation)),
  relations: async (subject: { articleId?: string; eventId?: string; surveyId?: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams(Object.entries(subject).filter((entry): entry is [string, string] => entry[1] !== undefined));
    return decode(await request(`/admin/content-matchers?${query}`, 'GET', undefined, signal), isMatcherList);
  },
  createRelation: async (input: CreateContentMatcherRequest) => decode(await request('/admin/content-matchers', 'POST', input), isMatcher),
  deleteRelation: async (id: string): Promise<void> => { await request(`/admin/content-matchers/${id}`, 'DELETE'); },
  export: async (id: string, input: ExportSurveyRequest, signal?: AbortSignal): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/admin/surveys/${id}/export`, { method: 'POST', credentials: 'include', headers: { Accept: 'text/csv, application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => undefined);
      const envelope = isErrorEnvelope(payload) ? payload : undefined;
      throw new SurveyApiError(response.status, envelope?.code, envelope?.message, envelope?.requestId);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
  clearSession: async (): Promise<void> => { await request('/auth/logout', 'POST'); },
};
