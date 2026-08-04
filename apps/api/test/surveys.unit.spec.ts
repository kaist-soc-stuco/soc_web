import { ForbiddenException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import type { SurveyQuestionDefinitionInput } from '@soc/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import { SurveysService } from '../src/features/surveys/surveys.service';
import { canonicalJson, canonicalSurveyDefinition } from '../src/features/surveys/survey-definition-canonical';

const actorId = '11111111-1111-4111-8111-111111111111';
const surveyId = '22222222-2222-4222-8222-222222222222';
const sectionId = '33333333-3333-4333-8333-333333333333';
const responseId = '44444444-4444-4444-8444-444444444444';
const correlationId = 'survey-unit-correlation';
const now = new Date('2026-07-27T12:00:00.000Z');
const surveyHmacKey = Buffer.alloc(32, 1);
const priorSurveyHmacKey = Buffer.alloc(32, 2);

const detail = (overrides = {}) => ({
  survey: { id: surveyId, currentRevision: 1, definitionVersion: 1, state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 30, updatedAt: now },
  revision: { id: 'revision-1', titleKr: '설문', titleEn: 'Survey', descriptionKr: '설명', descriptionEn: 'Description' },
  sections: [], questions: [], choices: [], items: [], descriptionItems: [], imageBlocks: [], ...overrides,
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
    listAll: vi.fn(), listPublic: vi.fn(), reviewQueue: vi.fn(), detail: vi.fn().mockResolvedValue(detail()), create: vi.fn().mockResolvedValue(detail()), patch: vi.fn(), replaceDefinition: vi.fn(), submit: vi.fn(), myResponse: vi.fn(), myResponses: vi.fn(), responsePage: vi.fn(), responseDetail: vi.fn(), answers: vi.fn(), review: vi.fn(), aggregate: vi.fn(), export: vi.fn(), exportPage: vi.fn(), publish: vi.fn(), matcher: vi.fn(), deleteMatcher: vi.fn(), related: vi.fn(), purgeExpired: vi.fn(), claimImageCleanupCandidates: vi.fn(), beginImageCleanupDeletion: vi.fn(), completeImageCleanupClaim: vi.fn(), mutateImageMembership: vi.fn(), surveyImageAsset: vi.fn(),
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
  it('enforces the manage/review/both/neither survey discovery matrix', async () => {
    for (const grants of [[], ['SURVEY_MANAGE'], ['SURVEY_REVIEW'], ['SURVEY_MANAGE', 'SURVEY_REVIEW']]) {
      const { repository, service } = setup(grants);
      repository.listAll.mockResolvedValue([]);
      repository.reviewQueue.mockResolvedValue([]);
      if (grants.includes('SURVEY_MANAGE')) {
        await expect(service.listManaged(actorId, 'ko')).resolves.toEqual({ locale: 'ko', items: [] });
      } else {
        await expect(service.listManaged(actorId, 'ko')).rejects.toMatchObject({ status: 403 });
      }
      if (grants.includes('SURVEY_REVIEW')) {
        await expect(service.reviewQueue(actorId, 'ko')).resolves.toEqual({ items: [] });
      } else {
        await expect(service.reviewQueue(actorId, 'ko')).rejects.toMatchObject({ status: 403 });
      }
    }
  });
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
  it('maps Korean-only localized mismatches and image neighbors to typed client errors', async () => {
    const { repository, service } = setup();
    repository.patch.mockResolvedValue('INVALID_LOCALIZED_CONTENT');
    await expect(service.patch(actorId, surveyId, { title: localized }, correlationId))
      .rejects.toMatchObject({ response: { message: 'korean_only_localized_content_mismatch' } });
    repository.mutateImageMembership.mockResolvedValue('INVALID_NEIGHBOR');
    await expect(service.addImageMembership(actorId, surveyId, '44444444-4444-4444-8444-444444444444', {
      expectedDefinitionVersion: 1,
      clientMutationId: '33333333-3333-4333-8333-333333333333',
      set: 'SHARED',
      assetId: '55555555-5555-4555-8555-555555555555',
      afterMembershipId: '66666666-6666-4666-8666-666666666666',
    }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_image_membership_neighbor' } });
  });
  it('requires policy-toggle CAS and passes the expected version to the locked patch', async () => {
    const { repository, service } = setup();
    await expect(service.patch(actorId, surveyId, { onlyForKoreanSpeaker: true }, correlationId))
      .rejects.toMatchObject({ response: { message: 'expected_definition_version_required' } });

    repository.patch.mockResolvedValue('UPDATED');
    await expect(service.patch(actorId, surveyId, {
      onlyForKoreanSpeaker: true,
      expectedDefinitionVersion: 1,
    }, correlationId)).resolves.toMatchObject({ id: surveyId });
    expect(repository.patch).toHaveBeenCalledWith(
      surveyId,
      actorId,
      expect.objectContaining({ onlyForKoreanSpeaker: true }),
      {},
      1,
      correlationId,
    );
  });

  it('rejects retained image-block mode changes in full definitions', async () => {
    const { repository, service } = setup();
    repository.replaceDefinition.mockResolvedValue('IMAGE_BLOCK_MODE_CHANGE_FORBIDDEN');
    await expect(service.definition(actorId, surveyId, {
      expectedDefinitionVersion: 1,
      sections: [{
        id: sectionId,
        ordinal: 0,
        title: localized,
        items: [{ id: '55555555-5555-4555-8555-555555555555', ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'LOCALIZED' }],
      }],
    }, correlationId)).rejects.toMatchObject({
      response: { message: 'image_block_mode_change_requires_endpoint' },
    });
  });
  it('accepts ID-less description and image-block definition items', async () => {
    const { repository, service } = setup();
    repository.replaceDefinition.mockResolvedValue('UPDATED');
    const sections = [{ ordinal: 0, title: localized, items: [
      { ordinal: 0, kind: 'DESCRIPTION', body: localized },
      { ordinal: 1, kind: 'IMAGE_BLOCK', mode: 'SHARED' },
    ] }];
    await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections }, correlationId))
      .resolves.toMatchObject({ survey: { id: surveyId } });
    expect(repository.replaceDefinition).toHaveBeenCalledWith(surveyId, actorId, 1, sections, correlationId);
  });

  it('accepts each honest discriminated question definition and rejects unknown or incompatible definitions through CAS replacement', async () => {
    const { repository, service } = setup();
    repository.replaceDefinition.mockResolvedValue('UPDATED');
    for (const question of questionDefinitions) {
      await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [{ ordinal: 0, title: localized, items: [{ ordinal: 0, kind: 'QUESTION', question }] }] }, correlationId)).resolves.toMatchObject({ survey: { id: surveyId } });
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
      await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [{ ordinal: 0, title: localized, items: [{ ordinal: 0, kind: 'QUESTION', question: invalid }] }] }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_question' } });
    }
    await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [], extra: true }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_definition' } });
  });
  it('accepts PostgreSQL-safe literal hyphens and rejects chained character ranges through CAS replacement', async () => {
    const { repository, service } = setup();
    repository.replaceDefinition.mockResolvedValue('UPDATED');
    for (const validationRegex of ['^[-A-Z]+$', '^[A-Z-]+$']) {
      await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [{ ordinal: 0, title: localized, items: [{ ordinal: 0, kind: 'QUESTION', question: { ...questionDefinitions[0], validationRegex } }] }] }, correlationId)).resolves.toMatchObject({ survey: { id: surveyId } });
    }
    for (const validationRegex of ['^[a-c-e]+$', '^[A-Z-0]+$']) {
      await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [{ ordinal: 0, title: localized, items: [{ ordinal: 0, kind: 'QUESTION', question: { ...questionDefinitions[0], validationRegex } }] }] }, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_question' } });
    }
  });
  it('validates complete bilingual definitions and maps stale CAS conflicts', async () => {
    const { repository, service } = setup();
    const sections = [{
      ordinal: 0,
      title: { kr: '기본 정보', en: 'Basics' },
      items: [
        { ordinal: 0, kind: 'DESCRIPTION', body: { kr: '한국어 설명', en: 'English description' } },
        { ordinal: 1, kind: 'QUESTION', question: { ...questionDefinitions[0], ordinal: 1, prompt: { kr: '이름', en: 'Name' } } },
      ],
    }];
    repository.replaceDefinition.mockResolvedValue('UPDATED');

    await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections }, correlationId))
      .resolves.toMatchObject({ survey: { definitionVersion: 1, sections: [] } });
    expect(repository.replaceDefinition).toHaveBeenCalledWith(surveyId, actorId, 1, sections, correlationId);


    repository.replaceDefinition.mockResolvedValue('STALE');
    await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections }, correlationId))
      .rejects.toMatchObject({ status: 409, response: { message: 'stale_definition' } });
    await expect(service.definition(actorId, surveyId, { expectedDefinitionVersion: 1, sections: [{ ...sections[0], ordinal: 1 }] }, correlationId))
      .rejects.toMatchObject({ response: { message: 'invalid_definition' } });
  });
  it('applies the configured canonical definition byte boundary before repository mutation', async () => {
    const definition = (suffix: string) => ({
      expectedDefinitionVersion: 1,
      sections: [{
        ordinal: 0,
        title: { kr: '경계 설문', en: `Boundary survey${suffix}` },
        items: [{ ordinal: 0, kind: 'QUESTION', question: {
          ordinal: 0,
          type: 'SHORT_TEXT',
          prompt: { kr: '따옴표 "와 역슬래시 \\를 포함한 질문', en: 'Escaped " question' },
          helpText: { kr: '한국어 UTF-8', en: 'escaped " quote and \\ slash' },
          required: true,
          validationRegex: null,
        } }],
      }],
    });
    const exact = definition('x'.repeat(128));
    const exactBytes = Buffer.byteLength(canonicalJson(canonicalSurveyDefinition(exact)), 'utf8');
    const over = definition(`${'x'.repeat(128)}y`);
    const overBytes = Buffer.byteLength(canonicalJson(canonicalSurveyDefinition(over)), 'utf8');
    const { repository, service } = setup(['SURVEY_MANAGE', 'SURVEY_REVIEW'], {
      SURVEY_DEFINITION_MAX_BYTES: exactBytes,
    });
    repository.replaceDefinition.mockResolvedValue('UPDATED');

    expect(exactBytes).toBeGreaterThan(0);
    expect(overBytes).toBe(exactBytes + 1);
    await expect(service.definition(actorId, surveyId, exact, correlationId)).resolves.toMatchObject({
      survey: { definitionVersion: 1 },
    });
    expect(repository.replaceDefinition).toHaveBeenCalledWith(
      surveyId, actorId, 1, exact.sections, correlationId,
    );

    repository.replaceDefinition.mockClear();
    await expect(service.definition(actorId, surveyId, over, correlationId))
      .rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.definition(actorId, surveyId, over, correlationId))
      .rejects.toMatchObject({ status: 413, response: { message: 'payload_too_large' } });
    expect(repository.replaceDefinition).not.toHaveBeenCalled();
  });


  it('projects localized survey content in the requested Korean and English locale', async () => {
    const { repository, service } = setup();
    const localizedDetail = detail({
      survey: { ...detail().survey, state: 'OPEN' },
      sections: [{ id: sectionId, ordinal: 0, titleKr: '문항', titleEn: 'Questions' }],
      questions: [{ id: 'q1', sectionId, ordinal: 0, type: 'SHORT_TEXT', promptKr: '질문', promptEn: 'Question', helpTextKr: null, helpTextEn: null, required: true }],
      choices: [], items: [{ id: 'item-1', sectionId, ordinal: 0, kind: 'QUESTION', questionId: 'q1' }], descriptionItems: [], imageBlocks: [],
    });
    repository.detail.mockResolvedValue(localizedDetail);
    await expect(service.get(undefined, surveyId, 'ko')).resolves.toMatchObject({ locale: 'ko', title: { value: '설문' }, sections: [{ title: { value: '문항' }, items: [{ kind: 'QUESTION', question: { prompt: { value: '질문' } } }] }] });
    await expect(service.get(undefined, surveyId, 'en')).resolves.toMatchObject({ locale: 'en', title: { value: 'Survey' }, sections: [{ title: { value: 'Questions' }, items: [{ kind: 'QUESTION', question: { prompt: { value: 'Question' } } }] }] });
  });
  it('keeps admin English authoring distinct from Korean-only public projection', async () => {
    const { repository, service } = setup();
    repository.detail.mockResolvedValue(detail({
      survey: { ...detail().survey, state: 'OPEN', onlyForKoreanSpeaker: true },
      sections: [{ id: sectionId, ordinal: 0, titleKr: '문항', titleEn: 'Questions' }],
      questions: [{ id: 'q1', sectionId, ordinal: 0, type: 'SHORT_TEXT', promptKr: '질문', promptEn: 'Question', helpTextKr: null, helpTextEn: null, required: true }],
      choices: [],
      items: [{ id: 'item-1', sectionId, ordinal: 0, kind: 'QUESTION', questionId: 'q1' }],
      descriptionItems: [],
      imageBlocks: [],
    }));
    await expect(service.get(undefined, surveyId, 'en')).resolves.toMatchObject({
      requestedLocale: 'en',
      effectiveContentLocale: 'ko',
      title: { value: '설문' },
      sections: [{ items: [{ question: { prompt: { value: '질문' } } }] }],
    });
    await expect(service.adminRequestedLocale(actorId, surveyId, 'en')).resolves.toMatchObject({
      requestedLocale: 'en',
      effectiveContentLocale: 'en',
      title: { value: 'Survey' },
      sections: [{ items: [{ question: { prompt: { value: 'Question' } } }] }],
    });
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
    await expect(denied.service.aggregate(actorId, surveyId, 'ko')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(denied.service.aggregateV2(actorId, surveyId, 'ko')).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied.repository.create).not.toHaveBeenCalled();
    expect(denied.repository.aggregate).not.toHaveBeenCalled();
  });

  it('suppresses aggregate cells below five and exposes exact counts at five', async () => {
    const { repository, service } = setup();
    const aggregate = (count: number) => ({ responseCount: count, revisions: [{ surveyRevisionId: 'revision-1', revision: 1, responseCount: count, questions: [{ questionId: 'q1', promptKr: '질문', promptEn: 'question', responseCount: count, choices: [{ choiceOptionId: 'c1', valueKr: '선택', valueEn: 'choice', count }] }] }] });
    repository.aggregate.mockResolvedValueOnce(aggregate(4)).mockResolvedValueOnce(aggregate(5));
    await expect(service.aggregate(actorId, surveyId, 'ko')).resolves.toMatchObject({ surveySuppressed: true, revisions: [{ surveyRevisionId: 'revision-1', suppressed: true, responseCount: null, questions: [{ responseCount: null, choices: [{ count: null }] }] }] });
    await expect(service.aggregate(actorId, surveyId, 'en')).resolves.toMatchObject({ locale: 'en', surveySuppressed: false, revisions: [{ surveyRevisionId: 'revision-1', revision: 1, suppressed: false, responseCount: 5, questions: [{ prompt: { value: 'question', translationUnavailable: false }, responseCount: 5, choices: [{ count: 5 }] }] }] });
  });
  it('returns exact aggregate V2 counts below suppression threshold without response content', async () => {
    const { repository, service } = setup();
    repository.aggregate.mockResolvedValue({ responseCount: 4, revisions: [{ surveyRevisionId: 'revision-1', revision: 1, responseCount: 4, questions: [{ questionId: 'q1', promptKr: '질문', promptEn: 'question', responseCount: 0, choices: [{ choiceOptionId: 'c1', valueKr: '선택', valueEn: 'choice', count: 0 }] }] }] });
    await expect(service.aggregateV2(actorId, surveyId, 'ko')).resolves.toEqual({
      surveyId, locale: 'ko',
      revisions: [{ surveyRevisionId: 'revision-1', revision: 1, responseCount: 4, questions: [{ questionId: 'q1', prompt: { value: '질문', translationUnavailable: false }, responseCount: 0, choices: [{ choiceOptionId: 'c1', label: { value: '선택', translationUnavailable: false }, count: 0 }] }] }],
    });
  });

  it('exports in bounded response pages with a stable cursor', async () => {
    const { repository, service } = setup();
    const revisionId = '55555555-5555-4555-8555-555555555555';
    const first = { response_id: responseId, survey_revision_id: revisionId, revision: 1, state: 'SUBMITTED', submitted_at: now, submitted_at_cursor: now.toISOString(), answer_id: null };
    const secondId = '66666666-6666-4666-8666-666666666666';
    const secondAt = new Date('2026-07-27T12:01:00.000Z');
    const second = { response_id: secondId, survey_revision_id: revisionId, revision: 1, state: 'SUBMITTED', submitted_at: secondAt, submitted_at_cursor: secondAt.toISOString(), answer_id: null };
    repository.export.mockResolvedValue({ export: { id: 'export-1', requestedAt: now }, upperBoundary: { submittedAt: secondAt.toISOString(), responseId: secondId } });
    repository.exportPage.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]).mockResolvedValueOnce([]);
    const result = await service.export(actorId, surveyId, { format: 'CSV' }, correlationId);
    const iterator = result.chunks[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toContain('"survey_id"');
    expect((await iterator.next()).value).toContain(responseId);
    expect(repository.exportPage).toHaveBeenNthCalledWith(1, surveyId, 100, undefined, { submittedAt: secondAt.toISOString(), responseId: secondId });
    expect((await iterator.next()).value).toContain(secondId);
    expect(repository.exportPage).toHaveBeenNthCalledWith(2, surveyId, 100, { submittedAt: now.toISOString(), responseId }, { submittedAt: secondAt.toISOString(), responseId: secondId });
    await iterator.next();
    expect(repository.exportPage).toHaveBeenNthCalledWith(3, surveyId, 100, { submittedAt: secondAt.toISOString(), responseId: secondId }, { submittedAt: secondAt.toISOString(), responseId: secondId });
  });
  it('fails closed when persisted response definitions are missing from detail or CSV export', async () => {
    const revisionId = '55555555-5555-4555-8555-555555555555';
    const questionId = '66666666-6666-4666-8666-666666666666';
    const choiceId = '77777777-7777-4777-8777-777777777777';
    const responseDetail = (questions: object[], choices: object[]) => ({
      response: { id: responseId, surveyId, surveyRevisionId: revisionId, state: 'SUBMITTED', submittedAt: now, reviewedAt: null, reviewReason: null },
      revision: { id: revisionId, revision: 1 },
      questions,
      choices,
      answers: [{ questionId, textValue: null, numberValue: null, dateValue: null, choiceOptionIds: JSON.stringify([choiceId]) }],
    });

    const missingQuestion = setup();
    missingQuestion.repository.responseDetail.mockResolvedValue(responseDetail([], []));
    await expect(missingQuestion.service.responseDetail(actorId, surveyId, responseId, 'ko')).rejects.toThrow('survey_response_invariant');

    const missingChoice = setup();
    missingChoice.repository.responseDetail.mockResolvedValue(responseDetail([{ id: questionId, promptKr: '질문', promptEn: 'question' }], []));
    await expect(missingChoice.service.responseDetail(actorId, surveyId, responseId, 'ko')).rejects.toThrow('survey_response_invariant');

    const exportRow = (overrides: Record<string, unknown>) => ({
      response_id: responseId, survey_revision_id: revisionId, revision: 1, state: 'SUBMITTED', submitted_at: now, submitted_at_cursor: now.toISOString(),
      answer_id: '88888888-8888-4888-8888-888888888888', question_id: questionId, prompt_kr: '질문', prompt_en: 'question',
      text_value: null, number_value: null, date_value: null, choice_option_ids: JSON.stringify([choiceId]), selected_choice_id: choiceId,
      choice_id: choiceId, value_kr: '선택', value_en: 'choice', ...overrides,
    });
    for (const row of [exportRow({ prompt_kr: null, prompt_en: null }), exportRow({ choice_id: null })]) {
      const exported = setup();
      exported.repository.export.mockResolvedValue({ export: { id: 'export-1', requestedAt: now }, upperBoundary: { submittedAt: now.toISOString(), responseId } });
      exported.repository.exportPage.mockResolvedValue([row]);
      const { chunks } = await exported.service.export(actorId, surveyId, { format: 'CSV' }, correlationId);
      const iterator = chunks[Symbol.asyncIterator]();
      await iterator.next();
      await expect(iterator.next()).rejects.toThrow('survey_response_invariant');
    }
  });
  it('maps draft review and detail targets to privacy-safe not found responses', async () => {
    const { repository, service } = setup();
    repository.responseDetail.mockResolvedValue(null);
    repository.review.mockResolvedValue(null);

    await expect(service.responseDetail(actorId, surveyId, responseId, 'ko')).rejects.toMatchObject({ status: 404 });
    await expect(service.review(actorId, surveyId, responseId, {
      expectedSurveyRevisionId: '55555555-5555-4555-8555-555555555555', state: 'APPROVED',
    }, 'ko', correlationId)).rejects.toMatchObject({ status: 404 });
  });
  it('maps review transitions and accepts CSV exports without exposing responses', async () => {
    const { repository, service } = setup();
    const revisionId = '55555555-5555-4555-8555-555555555555';
    const responseDetail = { response: { id: responseId, surveyId, surveyRevisionId: revisionId, state: 'APPROVED', submittedAt: now, reviewedAt: now, reviewReason: null }, revision: { id: revisionId, revision: 1 }, questions: [], choices: [], answers: [] };
    repository.review.mockResolvedValueOnce('INVALID').mockResolvedValueOnce({ id: responseId });
    repository.responseDetail.mockResolvedValue(responseDetail);
    await expect(service.review(actorId, surveyId, responseId, { expectedSurveyRevisionId: revisionId, state: 'APPROVED', reason: 'not-allowed' }, 'ko', correlationId)).rejects.toMatchObject({ response: { message: 'invalid_response_transition' } });
    await expect(service.review(actorId, surveyId, responseId, { expectedSurveyRevisionId: revisionId, state: 'APPROVED' }, 'ko', correlationId)).rejects.toMatchObject({ response: { message: 'invalid_response_transition' } });
    await expect(service.review(actorId, surveyId, responseId, { expectedSurveyRevisionId: revisionId, state: 'APPROVED' }, 'en', correlationId)).resolves.toMatchObject({ surveyId, responseId, surveyRevisionId: revisionId, revision: 1, locale: 'en', state: 'APPROVED', reviewReason: null });
    await expect(service.review(actorId, surveyId, responseId, { expectedSurveyRevisionId: revisionId, state: 'REJECTED', reason: 'x'.repeat(501) }, 'ko', correlationId)).rejects.toMatchObject({ response: { message: 'invalid_response_transition' } });
    repository.review.mockResolvedValue({ id: responseId });
    await service.review(actorId, surveyId, responseId, { expectedSurveyRevisionId: revisionId, state: 'REJECTED', reason: '  insufficient information  ' }, 'ko', correlationId);
    expect(repository.review).toHaveBeenLastCalledWith(surveyId, responseId, revisionId, actorId, 'REJECTED', 'insufficient information', correlationId);
    repository.export.mockResolvedValue({ export: { id: 'export-1', requestedAt: now }, upperBoundary: null });
    repository.exportPage.mockResolvedValue([]);
    const exportResult = await service.export(actorId, surveyId, { format: 'CSV' }, correlationId);
    const chunks: string[] = [];
    for await (const chunk of exportResult.chunks) chunks.push(chunk);
    expect(chunks).toEqual(['\uFEFF"survey_id","survey_revision_id","revision","response_id","state","submitted_at","question_id","question_label","question_translation_unavailable","answer_kind","answer_value","choice_option_id","choice_label","choice_translation_unavailable"\r\n']);
    expect(repository.exportPage).not.toHaveBeenCalled();
    await expect(service.export(actorId, surveyId, { format: 'JSON' }, correlationId)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
  it('accepts one optional related-content subject and rejects unknown or ambiguous query keys', async () => {
    const { repository, service } = setup();
    repository.related.mockResolvedValue([]);

    await expect(service.related({ surveyId, locale: 'ko' })).resolves.toEqual({ items: [] });
    expect(repository.related).toHaveBeenCalledWith({ articleId: undefined, eventId: undefined, surveyId }, 'ko');
    await expect(service.related({ surveyId, locale: 'ko', unexpected: 'x' })).rejects.toMatchObject({ response: { message: 'invalid_content_relation_query' } });
    await expect(service.related({ surveyId, articleId: actorId, locale: 'ko' })).rejects.toMatchObject({ response: { message: 'invalid_content_relation_query' } });
  });

  it('returns response answers that match the public contract without row timestamps', async () => {
    const { repository, service } = setup();
    repository.myResponse.mockResolvedValue({ id: responseId, state: 'SUBMITTED', submittedAt: now, reviewedAt: null, reviewReason: null, guestPhoneCiphertext: null });
    repository.answers.mockResolvedValue([{ questionId: sectionId, textValue: 'answer', submittedAt: now }]);

    await expect(service.mine(actorId, surveyId)).resolves.toEqual({
      response: {
        id: responseId,
        state: 'SUBMITTED',
        answers: [{ questionId: sectionId, textValue: 'answer', numberValue: undefined, dateValue: undefined, choiceOptionIds: undefined }],
        submittedAt: now.toISOString(),
        reviewedAt: null,
        reviewReason: null,
        phonePresent: false,
        maskedPhone: null,
      },
    });
  });
  it('claims assets before provider deletion and records provider failures for retry', async () => {
    const { repository, service } = setup(['SURVEY_MANAGE'], {
      ASSET_PROVIDER_ENABLED: true,
      ASSET_PROVIDER_URL: 'https://assets.example',
      ASSET_PROVIDER_TOKEN: 'token',
    });
    const asset = { id: '99999999-9999-4999-8999-999999999999', objectKey: 'cleanup-key' };
    repository.claimImageCleanupCandidates.mockResolvedValue({ claims: [{ asset, claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }], exhaustedAssetIds: [] });
    repository.beginImageCleanupDeletion.mockResolvedValue(asset);
    repository.completeImageCleanupClaim.mockResolvedValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(service.cleanupSurveyImages(now)).resolves.toEqual({ claimed: 1, deleted: 0, retried: 1, exhausted: 0 });
    expect(repository.beginImageCleanupDeletion).toHaveBeenCalledWith(asset.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now);
    expect(repository.completeImageCleanupClaim).toHaveBeenCalledWith(asset.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now, 'provider_delete_failed');
    vi.unstubAllGlobals();
  });
  it('reports terminal cleanup exhaustion without calling the provider', async () => {
    const { repository, service } = setup(['SURVEY_MANAGE', 'SURVEY_REVIEW'], {
      ASSET_PROVIDER_URL: 'https://assets.example',
      ASSET_PROVIDER_TOKEN: 'token',
    });
    repository.claimImageCleanupCandidates.mockResolvedValue({ claims: [], exhaustedAssetIds: ['99999999-9999-4999-8999-999999999999'] });
    await expect(service.cleanupSurveyImages(now)).resolves.toEqual({ claimed: 0, deleted: 0, retried: 0, exhausted: 1 });
  });
});
