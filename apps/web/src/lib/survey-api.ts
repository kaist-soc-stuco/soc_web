import type { AdminSurveyResponseListResponse, AppErrorResponse, ContentLocale, CreateSurveyRequest, ExportSurveyRequest, GetMySurveyResponseResponse, LoginSessionResponse, MySurveyResponsesResponse, PatchSurveyRequest, PublishSurveyResponse, ReplaceSectionQuestionsRequest, ReplaceSurveySectionsRequest, ReviewSurveyResponseRequest, SubmitSurveyResponseRequest, SurveyAggregateResponse, SurveyDto, SurveyListResponse, SurveyResponseAnswerDto, SurveyResponseDto } from '@soc/contracts';

export type RestrictedPattern = { allowed: ReadonlySet<string>; minimum: number; maximum: number };
export type SubmitSurveyResult = { status: 'ACCEPTED' } | { response: SurveyResponseDto };

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
export class SurveyApiError extends Error { constructor(public readonly status: number, public readonly code?: string, message?: string) { super(message ?? `HTTP ${status}`); this.name = 'SurveyApiError'; } }
export class SurveyApiProtocolError extends Error { constructor(message = 'The server returned an invalid JSON response.') { super(message); this.name = 'SurveyApiProtocolError'; } }
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is RecordValue => object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const string = (value: unknown): value is string => typeof value === 'string';
const nullable = (value: unknown, predicate: (input: unknown) => boolean) => value === null || predicate(value);
const enumValue = <T extends string>(values: readonly T[]) => (value: unknown): value is T => string(value) && values.includes(value as T);
const locale = enumValue(['ko', 'en'] as const);
const surveyState = enumValue(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ARCHIVED'] as const);
const responseState = enumValue(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'] as const);
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
const isSurvey = (value: unknown): value is SurveyDto => exact(value, ['id', 'revision', 'locale', 'title', 'description', 'state', 'guestAllowed', 'phoneRequired', 'feeRestriction', 'cap', 'opensAt', 'closesAt', 'editDeadlineAt', 'responseRetentionDays', 'sections', 'updatedAt']) && string(value.id) && Number.isInteger(value.revision) && locale(value.locale) && isLocalized(value.title) && nullable(value.description, isLocalized) && surveyState(value.state) && typeof value.guestAllowed === 'boolean' && typeof value.phoneRequired === 'boolean' && (value.feeRestriction === 'ANY' || value.feeRestriction === 'PAID_ONLY') && nullable(value.cap, (input) => typeof input === 'number') && nullable(value.opensAt, string) && nullable(value.closesAt, string) && nullable(value.editDeadlineAt, string) && Number.isInteger(value.responseRetentionDays) && Array.isArray(value.sections) && value.sections.every((section) => (exact(section, ['id', 'ordinal', 'title', 'questions']) || exact(section, ['id', 'ordinal', 'title', 'description', 'questions']) && nullable(section.description, isLocalized)) && string(section.id) && Number.isInteger(section.ordinal) && isLocalized(section.title) && Array.isArray(section.questions) && section.questions.every(isQuestion)) && string(value.updatedAt);
const decode = <T>(payload: unknown, predicate: (value: unknown) => value is T): T => { if (!predicate(payload)) throw new SurveyApiProtocolError(); return payload; };
function isErrorEnvelope(value: unknown): value is AppErrorResponse { return exact(value, ['code', 'message']) && string(value.code) && string(value.message); }
async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> { const response = await fetch(`${apiBaseUrl}${path}`, { method, signal, credentials: 'include', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); const payload: unknown = await response.json().catch(() => undefined); if (!response.ok) { const envelope = isErrorEnvelope(payload) ? payload : undefined; throw new SurveyApiError(response.status, envelope?.code, envelope?.message); } return payload; }
const isList = (value: unknown): value is SurveyListResponse => exact(value, ['locale', 'items']) && locale(value.locale) && Array.isArray(value.items) && value.items.every(isSurvey);
const isSession = (value: unknown): value is LoginSessionResponse => object(value) && Object.keys(value).every((key) => ['authenticated', 'canUsePersistentFeatures', 'requiresConsent', 'storageMode', 'userId'].includes(key)) && ['authenticated', 'canUsePersistentFeatures', 'requiresConsent', 'storageMode'].every((key) => key in value) && typeof value.authenticated === 'boolean' && typeof value.canUsePersistentFeatures === 'boolean' && typeof value.requiresConsent === 'boolean' && (value.storageMode === null || value.storageMode === 'temporary' || value.storageMode === 'persisted') && (!('userId' in value) || string(value.userId));
const isMine = (value: unknown): value is GetMySurveyResponseResponse => exact(value, ['response']) && nullable(value.response, isResponse);
const isAggregate = (value: unknown): value is SurveyAggregateResponse => exact(value, ['surveyId', 'responseCount', 'suppressed', 'questions']) && string(value.surveyId) && nullable(value.responseCount, (input) => typeof input === 'number') && typeof value.suppressed === 'boolean' && Array.isArray(value.questions) && value.questions.every((question) => exact(question, ['questionId', 'suppressed', 'responseCount', 'choices']) && string(question.questionId) && typeof question.suppressed === 'boolean' && nullable(question.responseCount, (input) => typeof input === 'number') && Array.isArray(question.choices) && question.choices.every((choice) => exact(choice, ['choiceOptionId', 'count']) && string(choice.choiceOptionId) && nullable(choice.count, (input) => typeof input === 'number')));
const isResponseList = (value: unknown): value is AdminSurveyResponseListResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['id', 'surveyId', 'state', 'submittedAt', 'reviewedAt', 'reviewReason', 'phonePresent', 'maskedPhone']) && string(item.id) && string(item.surveyId) && responseState(item.state) && nullable(item.submittedAt, string) && nullable(item.reviewedAt, string) && nullable(item.reviewReason, string) && typeof item.phonePresent === 'boolean' && nullable(item.maskedPhone, string));
const isMyResponses = (value: unknown): value is MySurveyResponsesResponse => exact(value, ['items']) && Array.isArray(value.items) && value.items.every((item) => exact(item, ['survey', 'response']) && isSurvey(item.survey) && isResponse(item.response));

export const surveyApi = {
  list: async (signal?: AbortSignal, selectedLocale?: ContentLocale) => decode(await request(`/surveys${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isList),
  listAdmin: async (signal?: AbortSignal) => decode(await request('/surveys', 'GET', undefined, signal), isList),
  session: async (signal?: AbortSignal) => decode(await request('/auth/session', 'GET', undefined, signal), isSession),
  get: async (id: string, selectedLocale?: ContentLocale, signal?: AbortSignal) => decode(await request(`/surveys/${id}${selectedLocale ? `?locale=${selectedLocale}` : ''}`, 'GET', undefined, signal), isSurvey),
  create: async (input: CreateSurveyRequest) => decode(await request('/admin/surveys', 'POST', input), isSurvey),
  patch: async (id: string, input: PatchSurveyRequest) => decode(await request(`/admin/surveys/${id}`, 'PATCH', input), isSurvey),
  replaceSections: async (id: string, input: ReplaceSurveySectionsRequest) => decode(await request(`/admin/surveys/${id}/sections`, 'PUT', input), isSurvey),
  replaceQuestions: async (sectionId: string, input: ReplaceSectionQuestionsRequest) => decode(await request(`/admin/sections/${sectionId}/questions`, 'PUT', input), isSurvey),
  publish: async (id: string): Promise<PublishSurveyResponse> => decode(await request(`/admin/surveys/${id}/publish`, 'POST'), (value): value is PublishSurveyResponse => exact(value, ['survey']) && isSurvey(value.survey)),
  submit: async (id: string, input: SubmitSurveyResponseRequest): Promise<SubmitSurveyResult> => decode(await request(`/surveys/${id}/responses`, 'POST', input), (value): value is SubmitSurveyResult => exact(value, ['status']) && value.status === 'ACCEPTED' || exact(value, ['response']) && isResponse(value.response)),
  mine: async (id: string, signal?: AbortSignal) => decode(await request(`/surveys/${id}/responses/me`, 'GET', undefined, signal), isMine),
  mineAll: async (signal?: AbortSignal) => decode(await request('/surveys/responses/me', 'GET', undefined, signal), isMyResponses),
  responses: async (id: string, signal?: AbortSignal) => decode(await request(`/admin/surveys/${id}/responses`, 'GET', undefined, signal), isResponseList),
  response: async (id: string, signal?: AbortSignal) => decode(await request(`/admin/survey-responses/${id}`, 'GET', undefined, signal), isResponse),
  review: async (id: string, input: ReviewSurveyResponseRequest) => decode(await request(`/admin/survey-responses/${id}/review`, 'POST', input), isResponse),
  aggregate: async (id: string) => decode(await request(`/admin/surveys/${id}/aggregate`), isAggregate),
  export: async (id: string, input: ExportSurveyRequest): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/admin/surveys/${id}/export`, { method: 'POST', credentials: 'include', headers: { Accept: 'text/csv', 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!response.ok) throw new SurveyApiError(response.status);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
