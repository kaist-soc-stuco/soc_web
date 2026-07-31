import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { SurveyQuestionDefinitionInput } from '@soc/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import { SurveysService } from '../src/features/surveys/surveys.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const surveyId = '22222222-2222-4222-8222-222222222222';
const sectionId = '33333333-3333-4333-8333-333333333333';
const responseId = '44444444-4444-4444-8444-444444444444';
const correlationId = 'survey-unit-correlation';
const now = new Date('2026-07-27T12:00:00.000Z');
const surveyHmacKey = Buffer.alloc(32, 1);
const priorSurveyHmacKey = Buffer.alloc(32, 2);

const detail = (overrides = {}) => ({
  survey: { id: surveyId, currentRevision: 1, state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 30, updatedAt: now },
  revision: { id: 'revision-1', titleKr: '설문', titleEn: 'Survey', descriptionKr: '설명', descriptionEn: 'Description' },
  sections: [], questions: [], choices: [], ...overrides,
});
const localized = { kr: '한국어', en: 'English' };
const surveyInput = () => ({ title: localized, guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 30 });
const questionDefinitions = [
  { ordinal: 0, type: 'SHORT_TEXT', prompt: localized, helpText: null, required: true, validationRegex: null },
  { ordinal: 0, type: 'LONG_TEXT', prompt: localized, helpText: null, required: true, validationRegex: null },
  { ordinal: 0, type: 'SINGLE_CHOICE', prompt: localized, helpText: null, required: true, choices: [{ ordinal: 0, value: localized }] },
  { ordinal: 0, type: 'MULTIPLE_CHOICE', prompt: localized, helpText: null, required: true, choices: [{ ordinal: 0, value: localized }] },
  { ordinal: 0, type: 'NUMBER', prompt: localized, helpText: null, required: true, numberMin: 1, numberMax: 10 },
  { ordinal: 0, type: 'DATE', prompt: localized, helpText: null, required: true, dateMin: '2026-01-01', dateMax: '2026-12-31' },
] satisfies SurveyQuestionDefinitionInput[];

function setup(grants: readonly string[] = ['SURVEY_MANAGE', 'SURVEY_REVIEW'], hmacConfig: Partial<Record<string, unknown>> = {}) {
  const repository = {
    listAll: vi.fn(), listPublic: vi.fn(), detail: vi.fn().mockResolvedValue(detail()), create: vi.fn().mockResolvedValue(detail()), patch: vi.fn(), replaceSections: vi.fn(), replaceQuestions: vi.fn(), submit: vi.fn(), myResponse: vi.fn(), myResponses: vi.fn(), responses: vi.fn(), response: vi.fn(), answers: vi.fn(), review: vi.fn(), aggregate: vi.fn(), export: vi.fn(), exportRows: vi.fn(), publish: vi.fn(), matcher: vi.fn(), deleteMatcher: vi.fn(), purgeExpired: vi.fn(),
  };
  const permissions = { hasPermission: vi.fn().mockImplementation(async (_actor: string, permission: string) => grants.includes(permission)) };
  const cipher = { encrypt: vi.fn().mockReturnValue('encrypted-phone') };
  const defaults: Record<string, unknown> = {
    SURVEY_PHONE_HASH_HMAC_KEY: surveyHmacKey.toString('base64'),
    SURVEY_PHONE_HASH_HMAC_VERSION: 'v2',
    SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: JSON.stringify({ v1: priorSurveyHmacKey.toString('base64') }),
  };
  const config = { get: vi.fn((key: string) => ({ ...defaults, ...hmacConfig })[key]) };
  return { repository, permissions, cipher, service: new SurveysService(repository as never, permissions as never, cipher as never, config as never) };
}

const invalidSurvey = (input: unknown) => expect(setup().service.create(actorId, input, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_survey' } });

describe('SurveysService', () => {
  it('rejects unknown survey keys and semantic-invalid settings before persistence', async () => {
    await invalidSurvey({ ...surveyInput(), unexpected: true });
    await invalidSurvey({ ...surveyInput(), responseRetentionDays: 0 });
    await invalidSurvey({ ...surveyInput(), cap: 0 });
    await invalidSurvey({ ...surveyInput(), opensAt: '2026-08-02T00:00:00.000Z', closesAt: '2026-08-01T00:00:00.000Z' });
    await invalidSurvey({ ...surveyInput(), closesAt: '2026-08-01T00:00:00.000Z', editDeadlineAt: '2026-08-02T00:00:00.000Z' });
    await invalidSurvey({ ...surveyInput(), title: { kr: '한국어', en: '   ' } });
    for (const requiredKey of ['guestAllowed', 'phoneRequired', 'feeRestriction', 'responseRetentionDays']) {
      const missing = surveyInput() as Record<string, unknown>;
      delete missing[requiredKey];
      await invalidSurvey(missing);
    }
    const { repository, service } = setup();
    repository.create.mockResolvedValue(detail());
    await service.create(actorId, { ...surveyInput(), guestAllowed: true, phoneRequired: false }, correlationId);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ guestAllowed: true, phoneRequired: false, responseRetentionDays: 30, state: 'DRAFT' }), expect.objectContaining({ titleKr: '한국어', titleEn: 'English' }), correlationId);
  });

  it('rejects unknown patch keys and maps immutable and invalid settings patch outcomes', async () => {
    const { repository, service } = setup();
    await expect(service.patch(actorId, surveyId, { cap: 2, extra: true }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_survey' } });
    repository.patch.mockResolvedValueOnce('IMMUTABLE').mockResolvedValueOnce('INVALID_SETTINGS');
    await expect(service.patch(actorId, surveyId, { cap: 2 }, correlationId)).rejects.toMatchObject({ response: { message: 'survey_immutable' } });
    await expect(service.patch(actorId, surveyId, { cap: 2 }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_survey' } });
  });

  it('accepts each honest discriminated question definition and rejects unknown or incompatible definitions', async () => {
    const { repository, service } = setup();
    repository.replaceQuestions.mockResolvedValue({ surveyId });
    for (const definition of questionDefinitions) {
      await expect(service.questions(actorId, sectionId, { questions: [definition] }, correlationId)).resolves.toMatchObject({ id: surveyId });
    }
    for (const invalid of [
      { ...questionDefinitions[0], type: 'RATING' },
      { ...questionDefinitions[0], choices: [] },
      { ...questionDefinitions[2], choices: undefined },
      { ...questionDefinitions[4], numberMin: 11, numberMax: 10 },
      { ...questionDefinitions[5], dateMin: '2026-12-31', dateMax: '2026-01-01' },
      { ...questionDefinitions[2], choices: [{ ordinal: 0, value: localized }, { ordinal: 0, value: localized }] },
      { ...questionDefinitions[2], choices: [{ ordinal: 1, value: localized }] },
      { ...questionDefinitions[0], prompt: { ...localized, extra: true } },
    ]) {
      await expect(service.questions(actorId, sectionId, { questions: [invalid] }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_question' } });
    }
    await expect(service.questions(actorId, sectionId, { questions: [], extra: true }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_questions' } });
  });
  it('accepts PostgreSQL-safe literal hyphens and rejects chained character ranges', async () => {
    const { repository, service } = setup();
    repository.replaceQuestions.mockResolvedValue({ surveyId });
    for (const validationRegex of ['^[-A-Z]+$', '^[A-Z-]+$']) {
      await expect(service.questions(actorId, sectionId, { questions: [{ ...questionDefinitions[0], validationRegex }] }, correlationId)).resolves.toMatchObject({ id: surveyId });
    }
    for (const validationRegex of ['^[a-c-e]+$', '^[A-Z-0]+$']) {
      await expect(service.questions(actorId, sectionId, { questions: [{ ...questionDefinitions[0], validationRegex }] }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_question' } });
    }
  });


  it('projects localized survey content in the requested Korean and English locale', async () => {
    const { repository, service } = setup();
    const localizedDetail = detail({
      survey: { ...detail().survey, state: 'OPEN' },
      sections: [{ id: sectionId, ordinal: 0, titleKr: '문항', titleEn: 'Questions' }],
      questions: [{ id: 'q1', sectionId, ordinal: 0, type: 'SHORT_TEXT', promptKr: '질문', promptEn: 'Question', helpTextKr: null, helpTextEn: null, required: true }],
      choices: [],
    });
    repository.detail.mockResolvedValue(localizedDetail);
    await expect(service.get(undefined, surveyId, 'ko')).resolves.toMatchObject({ locale: 'ko', title: { value: '설문' }, sections: [{ title: { value: '문항' }, questions: [{ prompt: { value: '질문' } }] }] });
    await expect(service.get(undefined, surveyId, 'en')).resolves.toMatchObject({ locale: 'en', title: { value: 'Survey' }, sections: [{ title: { value: 'Questions' }, questions: [{ prompt: { value: 'Question' } }] }] });
  });

  it('generates active and prior HMAC candidates from canonical 32-byte base64 keys without disclosure', async () => {
    const { repository, cipher, service } = setup();
    await expect(service.submit(undefined, surveyId, { answers: [], guestPhone: '010-1234-5678' }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_guest_phone' } });
    repository.submit.mockResolvedValue({ response: { id: responseId, state: 'SUBMITTED', guestPhoneCiphertext: 'encrypted-phone', submittedAt: now, reviewedAt: null, reviewReason: null }, answers: [] });
    const result = await service.submit(undefined, surveyId, { answers: [], guestPhone: '+821012345678' }, correlationId);
    const activeHash = createHmac('sha256', surveyHmacKey).update(`survey-response\u0000${surveyId}\u0000+821012345678`).digest('base64url');
    const priorHash = createHmac('sha256', priorSurveyHmacKey).update(`survey-response\u0000${surveyId}\u0000+821012345678`).digest('base64url');
    expect(cipher.encrypt).toHaveBeenCalledWith('survey-response-phone', '+821012345678');
    expect(repository.submit).toHaveBeenCalledWith(surveyId, undefined, {
      ciphertext: 'encrypted-phone', version: 'v2', hash: activeHash,
      candidates: [{ version: 'v2', hash: activeHash }, { version: 'v1', hash: priorHash }],
    }, [], correlationId);
    expect(JSON.stringify(result)).not.toContain('+821012345678');
    expect(result).toEqual({ status: 'ACCEPTED' });
  });
  it('rejects malformed, non-canonical, and overlapping guest HMAC key configuration', async () => {
    for (const hmacConfig of [
      { SURVEY_PHONE_HASH_HMAC_KEY: Buffer.alloc(31).toString('base64') },
      { SURVEY_PHONE_HASH_HMAC_KEY: `${surveyHmacKey.toString('base64')}=` },
      { SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: '{"v1":"not-base64"}' },
      { SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: JSON.stringify({ v2: priorSurveyHmacKey.toString('base64') }) },
      { SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: '{' },
    ]) {
      const { repository, service } = setup(['SURVEY_MANAGE', 'SURVEY_REVIEW'], hmacConfig);
      await expect(service.submit(undefined, surveyId, { answers: [], guestPhone: '+821012345678' }, correlationId)).rejects.toThrow('survey_phone_hash_configuration_invalid');
      expect(repository.submit).not.toHaveBeenCalled();
    }
  });
  it('maps guest duplicate and full-cap outcomes to the same non-disclosing response', async () => {
    const { repository, service } = setup();
    repository.submit.mockResolvedValueOnce('DUPLICATE').mockResolvedValueOnce('CAP');
    await expect(service.submit(undefined, surveyId, { answers: [], guestPhone: '+821012345678' }, correlationId)).resolves.toEqual({ status: 'ACCEPTED' });
    await expect(service.submit(undefined, surveyId, { answers: [], guestPhone: '+821087654321' }, correlationId)).resolves.toEqual({ status: 'ACCEPTED' });
  });

  it('enforces distinct manage and review permissions', async () => {
    const denied = setup([]);
    await expect(denied.service.create(actorId, surveyInput(), correlationId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(denied.service.aggregate(actorId, surveyId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied.repository.create).not.toHaveBeenCalled();
    expect(denied.repository.aggregate).not.toHaveBeenCalled();
  });

  it('suppresses aggregate cells below five and exposes exact counts at five', async () => {
    const { repository, service } = setup();
    const aggregate = (count: number) => ({ count, questions: [{ id: 'q1', type: 'SINGLE_CHOICE' }], choices: [{ id: 'c1', questionId: 'q1' }], questionCounts: new Map([['q1', count]]), choiceCounts: new Map([['c1', count]]) });
    repository.aggregate.mockResolvedValueOnce(aggregate(4)).mockResolvedValueOnce(aggregate(5));
    await expect(service.aggregate(actorId, surveyId)).resolves.toMatchObject({ suppressed: true, responseCount: null, questions: [{ responseCount: null, choices: [{ count: null }] }] });
    await expect(service.aggregate(actorId, surveyId)).resolves.toMatchObject({ suppressed: false, responseCount: 5, questions: [{ responseCount: 5, choices: [{ count: 5 }] }] });
  });

  it('maps review transitions and accepts CSV exports without exposing responses', async () => {
    const { repository, service } = setup();
    repository.review.mockResolvedValueOnce('INVALID').mockResolvedValueOnce({ id: responseId, state: 'APPROVED', submittedAt: now, reviewedAt: now, reviewReason: null });
    repository.answers.mockResolvedValue([]);
    await expect(service.review(actorId, responseId, { state: 'APPROVED', reason: 'not-allowed' }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_review' } });
    await expect(service.review(actorId, responseId, { state: 'APPROVED' }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_response_transition' } });
    await expect(service.review(actorId, responseId, { state: 'APPROVED' }, correlationId)).resolves.toMatchObject({ state: 'APPROVED', reviewReason: null });
    repository.export.mockResolvedValue({ id: 'export-1', requestedAt: now });
    repository.exportRows.mockResolvedValue({ detail: detail(), responses: [], answers: [] });
    await expect(service.export(actorId, surveyId, { format: 'CSV' }, correlationId)).resolves.toEqual({ filename: `survey-${surveyId}.csv`, csv: '\uFEFF"response_id","state","submitted_at"\r\n' });
    await expect(service.export(actorId, surveyId, { format: 'JSON' }, correlationId)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
