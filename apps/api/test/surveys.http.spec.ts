import { INestApplication, NotFoundException, RequestMethod, UnprocessableEntityException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type {
  ContentMatcherDto,
  GetMySurveyResponseResponse,
  ReplaceSurveyDefinitionRequest,
  SubmitSurveyResponse,
  SubmitSurveyResponseRequest,
  AdminSurveyAggregate,
  AdminSurveyExactAggregate,
  AdminSurveyResponseDetail,
  SurveyDto,
  SurveyResponseDto,
} from '@soc/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { SurveysService } from '../src/features/surveys/surveys.service';
import { AdminSurveysController, PublicSurveysController } from '../src/features/surveys/surveys.controller';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard, OptionalAuthGuard } from '../src/shared/guards';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';
import { configureSurveyBodyParsers } from '../src/main';
import { UsersService } from '../src/features/users/users.service';

const actorId = '10000000-0000-4000-8000-000000000001';
const surveyId = '10000000-0000-4000-8000-000000000002';
const responseId = '10000000-0000-4000-8000-000000000004';
const matcherId = '10000000-0000-4000-8000-000000000005';
const exactAggregate = {
  surveyId, locale: 'ko',
  revisions: [{ surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, responseCount: 4, questions: [{ questionId: '10000000-0000-4000-8000-000000000006', prompt: { value: '질문', translationUnavailable: false }, responseCount: 0, choices: [{ choiceOptionId: '10000000-0000-4000-8000-000000000007', label: { value: '선택', translationUnavailable: false }, count: 0 }] }] }],
} satisfies AdminSurveyExactAggregate;

describe('Survey HTTP boundary', () => {
  let app: INestApplication;
  let surveys: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    const survey = {
      id: surveyId, revision: 1, definitionVersion: 1, locale: 'ko', requestedLocale: 'ko', effectiveContentLocale: 'ko', onlyForKoreanSpeaker: false, title: { value: '설문', translationUnavailable: false }, description: null,
      state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null,
      editDeadlineAt: null, responseRetentionDays: 365, sections: [], updatedAt: '2026-07-27T00:00:00.000Z',
    } satisfies SurveyDto;
    const response = {
      id: responseId, state: 'SUBMITTED', answers: [{ questionId: 'question-1', textValue: 'answer' }],
      submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: true, maskedPhone: '010-****-5678',
    } satisfies SurveyResponseDto;
    const reviewedResponse = {
      responseId, surveyId, surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, locale: 'ko',
      state: 'SUBMITTED', submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null,
      answers: [{ questionId: 'question-1', prompt: { value: '질문', translationUnavailable: false }, value: { kind: 'text', textValue: 'answer' } }],
    } satisfies AdminSurveyResponseDetail;
    const aggregate = {
      surveyId, locale: 'ko', surveySuppressed: false,
      revisions: [{ surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, suppressed: false, responseCount: 5, questions: [{ questionId: '10000000-0000-4000-8000-000000000006', prompt: { value: '질문', translationUnavailable: false }, responseCount: 5, choices: [{ choiceOptionId: '10000000-0000-4000-8000-000000000007', label: { value: '선택', translationUnavailable: false }, count: 3 }] }] }],
    } satisfies AdminSurveyAggregate;
    const surveyExport = { filename: 'survey.csv', chunks: (async function* () { yield 'first,'; yield 'second\r\n'; })() };
    const matcher = {
      id: matcherId, articleId: surveyId, eventId: null, surveyId,
      relationType: 'ANNOUNCEMENT', syncMode: 'NONE', createdByUserId: surveyId,
      createdAt: '2026-07-27T00:00:00.000Z', updatedByUserId: surveyId,
      updatedAt: '2026-07-27T00:00:00.000Z', synchronizedAt: null,
    } satisfies ContentMatcherDto;
    surveys = {
      list: vi.fn().mockResolvedValue({ locale: 'ko', items: [survey] }), get: vi.fn().mockResolvedValue(survey),
      submit: vi.fn().mockResolvedValue({ status: 'ACCEPTED' } satisfies SubmitSurveyResponse), mine: vi.fn().mockResolvedValue({ response } satisfies GetMySurveyResponseResponse),
      mineAll: vi.fn().mockResolvedValue({ locale: 'ko', items: [{ survey, response }] }),
      related: vi.fn().mockResolvedValue({ items: [] }), imageMembershipPage: vi.fn().mockResolvedValue({ requestedLocale: 'ko', effectiveContentLocale: 'ko', items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1 }),
      listManaged: vi.fn().mockResolvedValue({ locale: 'ko', items: [survey] }),
      reviewQueue: vi.fn().mockResolvedValue({ items: [{ surveyId, title: survey.title, state: survey.state, responseCount: 1, latestResponseAt: null }] }),
      create: vi.fn().mockResolvedValue(survey), patch: vi.fn().mockResolvedValue(survey), adminRequestedLocale: vi.fn().mockResolvedValue(survey), publish: vi.fn().mockResolvedValue({ survey }), definition: vi.fn().mockResolvedValue({ survey }),
      materializeEvent: vi.fn().mockResolvedValue({ eventId: surveyId, relation: matcher }),
      responses: vi.fn().mockResolvedValue({ surveyId, locale: 'en', state: 'APPROVED', limit: 2, matchingCount: 1, items: [{ responseId, surveyId, surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, state: 'APPROVED', submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null }], nextCursor: null }),
      responseDetail: vi.fn().mockResolvedValue({ ...reviewedResponse, locale: 'en', answers: [{ questionId: 'question-1', prompt: { value: 'Question', translationUnavailable: false }, value: { kind: 'text', textValue: 'answer' } }] }),
      review: vi.fn().mockResolvedValue(reviewedResponse),
      aggregate: vi.fn().mockResolvedValue(aggregate), aggregateV2: vi.fn().mockResolvedValue(exactAggregate), addImageMembership: vi.fn(), removeImageMembership: vi.fn(), moveImageMembership: vi.fn(), changeImageBlockMode: vi.fn(),
      export: vi.fn().mockResolvedValue(surveyExport),
      listMatchers: vi.fn().mockResolvedValue({ items: [matcher] }),
      matcher: vi.fn().mockResolvedValue(matcher),
      deleteMatcher: vi.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [PublicSurveysController, AdminSurveysController],
      providers: [
        AuthGuard,
        OptionalAuthGuard,
        { provide: SurveysService, useValue: surveys },
        { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'sid' }) } },
        { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actorId }) } },
      ],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    const requestIdMiddleware = new RequestIdMiddleware();
    app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
    configureSurveyBodyParsers(app, 1_024);
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  const authenticated = (method: 'post' | 'patch' | 'put' | 'delete' | 'get', path: string) =>
    request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=access-token');

  const jsonOfByteLength = (bytes: number, multibyte = false): string => {
    const prefix = multibyte ? '가' : '';
    const base = JSON.stringify({ padding: prefix });
    return JSON.stringify({ padding: `${prefix}${'a'.repeat(bytes - Buffer.byteLength(base, 'utf8'))}` });
  };

  it('uses the bootstrap parser instances with definition precedence and canonical size failures', async () => {
    const requestId = 'definition-parser-boundary';
    const exact = jsonOfByteLength(1_024, true);
    expect(Buffer.byteLength(exact, 'utf8')).toBe(1_024);

    await authenticated('put', `/api/admin/surveys/${surveyId}/definition`)
      .set('X-Request-Id', requestId)
      .set('Content-Type', 'application/json')
      .send(exact)
      .expect(200);
    expect(surveys.definition).toHaveBeenLastCalledWith(actorId, surveyId, JSON.parse(exact), requestId);

    const oneOver = jsonOfByteLength(1_025, true);
    const definitionTooLarge = await authenticated('put', `/api/admin/surveys/${surveyId}/definition`)
      .set('X-Request-Id', requestId)
      .set('Content-Type', 'application/json')
      .send(oneOver)
      .expect(413);
    expect(definitionTooLarge.body).toEqual({
      code: 'payload_too_large',
      message: 'Request failed',
      requestId,
    });
    expect(surveys.definition).toHaveBeenCalledTimes(1);

    const unrelatedTooLarge = await authenticated('post', '/api/admin/surveys')
      .set('X-Request-Id', requestId)
      .set('Content-Type', 'application/json')
      .send(jsonOfByteLength(32 * 1024 + 1))
      .expect(413);
    expect(unrelatedTooLarge.body).toEqual({
      code: 'payload_too_large',
      message: 'Request failed',
      requestId,
    });
    expect(surveys.create).not.toHaveBeenCalled();
  });
  it('exposes exactly the thirty-one approved method/path operations and response bodies', async () => {
    const trace = 'survey-http-17';
    const guestPhone = '+821012345678';
    const excludedPhoneStorageFields = ['guestPhone', 'guestPhoneCiphertext', 'guestPhoneHash', 'guestPhoneHashVersion'];
    const detail = {
      id: surveyId, revision: 1, definitionVersion: 1, locale: 'ko', requestedLocale: 'ko', effectiveContentLocale: 'ko', onlyForKoreanSpeaker: false, title: { value: '설문', translationUnavailable: false }, description: null,
      state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null,
      editDeadlineAt: null, responseRetentionDays: 365, sections: [], updatedAt: '2026-07-27T00:00:00.000Z',
    };
    const projectedResponse = {
      responseId, surveyId, surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, locale: 'ko',
      state: 'SUBMITTED', submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null,
      answers: [{ questionId: 'question-1', prompt: { value: '질문', translationUnavailable: false }, value: { kind: 'text', textValue: 'answer' } }],
    } satisfies AdminSurveyResponseDetail;
    const myResponse = {
      id: responseId, state: 'SUBMITTED', answers: [{ questionId: 'question-1', textValue: 'answer' }],
      submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: true, maskedPhone: '010-****-5678',
    } satisfies SurveyResponseDto;
    const submission = { status: 'ACCEPTED' } satisfies SubmitSurveyResponse;
    const list = { locale: 'ko', items: [detail] };
    const managedList = { locale: 'ko', items: [detail] };
    const reviewQueue = { items: [{ surveyId, title: detail.title, state: detail.state, responseCount: 1, latestResponseAt: null }] };
    const responsePage = { surveyId, locale: 'en', state: 'APPROVED', limit: 2, matchingCount: 1, items: [{ responseId, surveyId, surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, state: 'APPROVED', submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null }], nextCursor: null };
    const responseDetail = { ...projectedResponse, locale: 'en', answers: [{ questionId: 'question-1', prompt: { value: 'Question', translationUnavailable: false }, value: { kind: 'text', textValue: 'answer' } }] } satisfies AdminSurveyResponseDetail;
    const related = { items: [] };
    const allMyResponses = { locale: 'ko', items: [{ survey: detail, response: myResponse }] };
    const materialized = { eventId: surveyId, relation: { id: matcherId, articleId: surveyId, eventId: null, surveyId, relationType: 'ANNOUNCEMENT', syncMode: 'NONE', createdByUserId: surveyId, createdAt: '2026-07-27T00:00:00.000Z', updatedByUserId: surveyId, updatedAt: '2026-07-27T00:00:00.000Z', synchronizedAt: null } };
    const aggregate = {
      surveyId, locale: 'ko', surveySuppressed: false,
      revisions: [{ surveyRevisionId: '10000000-0000-4000-8000-000000000008', revision: 1, suppressed: false, responseCount: 5, questions: [{ questionId: '10000000-0000-4000-8000-000000000006', prompt: { value: '질문', translationUnavailable: false }, responseCount: 5, choices: [{ choiceOptionId: '10000000-0000-4000-8000-000000000007', label: { value: '선택', translationUnavailable: false }, count: 3 }] }] }],
    } satisfies AdminSurveyAggregate;
    const matcher = { id: matcherId, articleId: surveyId, eventId: null, surveyId, relationType: 'ANNOUNCEMENT', syncMode: 'NONE', createdByUserId: surveyId, createdAt: '2026-07-27T00:00:00.000Z', updatedByUserId: surveyId, updatedAt: '2026-07-27T00:00:00.000Z', synchronizedAt: null } satisfies ContentMatcherDto;
    const create = {
      title: { kr: '설문', en: 'Survey' }, description: { kr: '설명', en: 'Description' }, guestAllowed: true, phoneRequired: true,
      feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365,
    };
    const patch = { title: { kr: '수정', en: 'Updated' } };
    const definition = {
      expectedDefinitionVersion: 1,
      sections: [{
        ordinal: 0, title: { kr: '기본', en: 'Basics' }, items: [{ ordinal: 0, kind: 'QUESTION', question: { ordinal: 0, prompt: { kr: '질문', en: 'Question' }, helpText: null, type: 'SHORT_TEXT', required: true, validationRegex: null } }],
      }],
    } satisfies ReplaceSurveyDefinitionRequest;
    const routes: Array<{
      method: 'get' | 'post' | 'patch' | 'put' | 'delete';
      path: string;
      body?: string | object;
      status: number;
      expectedBody: object | string;
      phoneDerived?: boolean;
    }> = [
      { method: 'get', path: '/api/surveys', status: 200, expectedBody: list },
      { method: 'get', path: `/api/surveys/${surveyId}?locale=en`, status: 200, expectedBody: detail },
      { method: 'get', path: `/api/surveys/${surveyId}/image-blocks/${surveyId}/memberships?set=SHARED&limit=25&locale=en`, status: 200, expectedBody: { requestedLocale: 'ko', effectiveContentLocale: 'ko', items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1 } },
      { method: 'post', path: `/api/surveys/${surveyId}/responses`, body: { answers: [{ questionId: 'question-1', textValue: 'answer' }], guestPhone } satisfies SubmitSurveyResponseRequest, status: 201, expectedBody: submission, phoneDerived: true },
      { method: 'get', path: `/api/surveys/${surveyId}/responses/me`, status: 200, expectedBody: { response: myResponse }, phoneDerived: true },
      { method: 'get', path: '/api/surveys/responses/me', status: 200, expectedBody: allMyResponses, phoneDerived: true },
      { method: 'get', path: `/api/surveys/content-relations?surveyId=${surveyId}&locale=en`, status: 200, expectedBody: related },
      { method: 'get', path: '/api/admin/surveys', status: 200, expectedBody: managedList },
      { method: 'get', path: '/api/admin/surveys/review-queue?locale=ko', status: 200, expectedBody: reviewQueue },
      { method: 'post', path: '/api/admin/surveys', body: create, status: 201, expectedBody: detail },
      { method: 'patch', path: `/api/admin/surveys/${surveyId}`, body: patch, status: 200, expectedBody: detail },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/publish`, status: 201, expectedBody: { survey: detail } },
      { method: 'put', path: `/api/admin/surveys/${surveyId}/definition`, body: definition, status: 200, expectedBody: { survey: detail } },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/materialize-event`, body: { location: 'Auditorium', visibility: 'PUBLIC' }, status: 201, expectedBody: materialized },
      { method: 'get', path: `/api/admin/surveys/${surveyId}/responses?state=APPROVED&limit=2&cursor=page-cursor&locale=en`, status: 200, expectedBody: responsePage },
      { method: 'get', path: `/api/admin/surveys/${surveyId}/responses/${responseId}?locale=en`, status: 200, expectedBody: responseDetail, phoneDerived: true },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/responses/${responseId}/review?locale=ko`, body: { expectedSurveyRevisionId: '10000000-0000-4000-8000-000000000008', state: 'APPROVED' }, status: 201, expectedBody: projectedResponse, phoneDerived: true },
      { method: 'get', path: `/api/admin/surveys/${surveyId}/aggregate`, status: 200, expectedBody: aggregate },
      { method: 'get', path: `/api/admin/surveys/${surveyId}/aggregate/v2`, status: 200, expectedBody: exactAggregate },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/export`, body: { format: 'CSV' }, status: 200, expectedBody: 'first,second\r\n' },
      { method: 'get', path: `/api/admin/content-matchers?surveyId=${surveyId}`, status: 200, expectedBody: { items: [matcher] } },
      { method: 'post', path: '/api/admin/content-matchers', body: { articleId: surveyId, surveyId, relationType: 'ANNOUNCEMENT' }, status: 201, expectedBody: matcher },
      { method: 'delete', path: `/api/admin/content-matchers/${matcherId}`, status: 204, expectedBody: '' },
    ];

    const registry = [PublicSurveysController, AdminSurveysController].flatMap((controller) => {
      const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) as string;
      return Object.getOwnPropertyNames(controller.prototype)
        .filter((name) => name !== 'constructor')
        .map((name) => {
          const handler = (controller.prototype as unknown as Record<string, object>)[name];
          const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
          const routePath = path === '/' ? '' : `/${path}`;
          return `${RequestMethod[method]} /api/${controllerPath}${routePath}`;
        });
    }).sort();

    expect(registry).toEqual([
      'DELETE /api/admin/content-matchers/:id', 'DELETE /api/admin/surveys/:surveyId/image-blocks/:blockId/memberships/:membershipId', 'GET /api/admin/content-matchers',
      'GET /api/admin/surveys', 'GET /api/admin/surveys/:id', 'GET /api/admin/surveys/:id/aggregate', 'GET /api/admin/surveys/:id/aggregate/v2', 'GET /api/admin/surveys/:surveyId/image-blocks/:blockId/memberships', 'GET /api/admin/surveys/:id/responses', 'GET /api/admin/surveys/:surveyId/responses/:responseId', 'GET /api/admin/surveys/review-queue',
      'GET /api/surveys', 'GET /api/surveys/:id', 'GET /api/surveys/:surveyId/image-blocks/:blockId/memberships', 'GET /api/surveys/:id/images/:imageId', 'GET /api/surveys/:id/responses/me', 'GET /api/surveys/content-relations', 'GET /api/surveys/responses/me',
      'PATCH /api/admin/surveys/:id', 'PATCH /api/admin/surveys/:surveyId/image-blocks/:blockId/memberships/:membershipId', 'POST /api/admin/content-matchers', 'POST /api/admin/survey-image-assets/:id/v2/complete', 'POST /api/admin/survey-image-assets/v2/initiate', 'POST /api/admin/surveys', 'POST /api/admin/surveys/:id/export', 'POST /api/admin/surveys/:id/materialize-event', 'POST /api/admin/surveys/:id/publish', 'POST /api/admin/surveys/:surveyId/image-blocks/:blockId/memberships', 'POST /api/admin/surveys/:surveyId/image-blocks/:blockId/mode', 'POST /api/admin/surveys/:surveyId/responses/:responseId/review', 'POST /api/surveys/:id/responses', 'PUT /api/admin/surveys/:id/definition',
    ].sort());

    for (const route of routes) {
      const response = request(app.getHttpServer())[route.method](route.path).set('x-request-id', trace);
      if (route.path.includes('/admin/') || route.path.endsWith('/responses/me')) response.set('Cookie', 'soc_at=access-token');
      const actual = await (route.body === undefined ? response : response.send(route.body)).expect(route.status);

      if (typeof route.expectedBody === 'string') {
        expect(actual.text).toBe(route.expectedBody);
        if (route.path.endsWith('/export')) {
          expect(actual.headers['content-type']).toContain('text/csv; charset=utf-8');
          expect(actual.headers['content-disposition']).toBe('attachment; filename="survey.csv"');
        }
      } else {
        expect(actual.body).toEqual(route.expectedBody);
        if (route.phoneDerived) {
          expect(actual.text).not.toContain(guestPhone);
          for (const field of excludedPhoneStorageFields) expect(actual.text).not.toContain(field);
        }
      }
      if (route.path.includes('/aggregate')) expect(actual.headers['cache-control']).toBe('private, no-store');
    }

    expect(surveys.list).toHaveBeenCalledWith(undefined, 'ko');
    expect(surveys.get).toHaveBeenCalledWith(undefined, surveyId, 'en');
    expect(surveys.imageMembershipPage).toHaveBeenCalledWith(undefined, surveyId, surveyId, { set: 'SHARED', limit: 25 }, 'en');
    expect(surveys.submit).toHaveBeenCalledWith(undefined, surveyId, { answers: [{ questionId: 'question-1', textValue: 'answer' }], guestPhone }, trace);
    expect(surveys.mine).toHaveBeenCalledWith(actorId, surveyId);
    expect(surveys.mineAll).toHaveBeenCalledWith(actorId, 'ko');
    expect(surveys.related).toHaveBeenCalledWith({ surveyId, locale: 'en' });
    expect(surveys.listManaged).toHaveBeenCalledWith(actorId, 'ko');
    expect(surveys.reviewQueue).toHaveBeenCalledWith(actorId, 'ko');
    expect(surveys.create).toHaveBeenCalledWith(actorId, create, trace);
    expect(surveys.patch).toHaveBeenCalledWith(actorId, surveyId, patch, trace);
    expect(surveys.publish).toHaveBeenCalledWith(actorId, surveyId, trace);
    expect(surveys.definition).toHaveBeenCalledWith(actorId, surveyId, definition, trace);
    expect(surveys.review).toHaveBeenCalledWith(actorId, surveyId, responseId, { expectedSurveyRevisionId: '10000000-0000-4000-8000-000000000008', state: 'APPROVED' }, 'ko', trace);
    expect(surveys.materializeEvent).toHaveBeenCalledWith(actorId, surveyId, { location: 'Auditorium', visibility: 'PUBLIC' }, trace);
    expect(surveys.responses).toHaveBeenCalledWith(actorId, surveyId, { state: 'APPROVED', limit: 2, cursor: 'page-cursor', locale: 'en' });
    expect(surveys.responseDetail).toHaveBeenCalledWith(actorId, surveyId, responseId, 'en');
    expect(surveys.aggregate).toHaveBeenCalledWith(actorId, surveyId, 'ko');
    expect(surveys.aggregateV2).toHaveBeenCalledWith(actorId, surveyId, 'ko');
    expect(surveys.export).toHaveBeenCalledWith(actorId, surveyId, { format: 'CSV' }, trace);
    expect(surveys.matcher).toHaveBeenCalledWith(actorId, { articleId: surveyId, surveyId, relationType: 'ANNOUNCEMENT' }, trace);
    expect(surveys.deleteMatcher).toHaveBeenCalledWith(actorId, matcherId, trace);
  });

  it('distinguishes optional public authentication from required survey operations', async () => {
    await request(app.getHttpServer()).get(`/api/surveys/${surveyId}`).expect(200);
    expect(surveys.get).toHaveBeenCalledWith(undefined, surveyId, 'ko');
    await request(app.getHttpServer()).get(`/api/surveys/${surveyId}/responses/me`).expect(401);
    await request(app.getHttpServer()).post('/api/admin/surveys').send({}).expect(401);
    expect(surveys.mine).not.toHaveBeenCalled();
    expect(surveys.create).not.toHaveBeenCalled();
  });

  it('rejects malformed UUIDs and aliases with their corresponding verbs before invoking services', async () => {
    const malformedOperations: Array<{ method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string; authenticated?: boolean }> = [
      { method: 'get', path: '/api/surveys/not-a-uuid' },
      { method: 'post', path: '/api/surveys/not-a-uuid/responses' },
      { method: 'get', path: '/api/surveys/not-a-uuid/responses/me', authenticated: true },
      { method: 'patch', path: '/api/admin/surveys/not-a-uuid', authenticated: true },
      { method: 'post', path: '/api/admin/surveys/not-a-uuid/publish', authenticated: true },
      { method: 'put', path: `/api/admin/surveys/not-a-uuid/definition`, authenticated: true },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/responses/not-a-uuid/review`, authenticated: true },
      { method: 'get', path: '/api/admin/surveys/not-a-uuid/aggregate', authenticated: true },
      { method: 'post', path: '/api/admin/surveys/not-a-uuid/export', authenticated: true },
      { method: 'delete', path: '/api/admin/content-matchers/not-a-uuid', authenticated: true },
    ];
    for (const operation of malformedOperations) {
      const response = request(app.getHttpServer())[operation.method](operation.path);
      if (operation.authenticated) response.set('Cookie', 'soc_at=access-token');
      await response.send({}).expect(404);
    }
    await request(app.getHttpServer()).get('/api/surveys?locale=fr').expect(422);
    await request(app.getHttpServer()).get('/api/surveys?locale=ko&extra=true').expect(422);
    const aliases: Array<{ method: 'get' | 'post' | 'put'; path: string }> = [
      { method: 'get', path: '/api/survey' },
      { method: 'post', path: `/api/surveys/${surveyId}/response` },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/responses` },
      { method: 'post', path: '/api/admin/survey-matchers' },
      { method: 'put', path: `/api/admin/surveys/${surveyId}/sections` },
      { method: 'put', path: `/api/admin/sections/${surveyId}/questions` },
    ];
    for (const alias of aliases) {
      const response = request(app.getHttpServer())[alias.method](alias.path);
      if (alias.path.includes('/admin/')) response.set('Cookie', 'soc_at=access-token');
      await response.send({}).expect(404);
    }
    for (const service of Object.values(surveys)) expect(service).not.toHaveBeenCalled();
  });

  it('returns the same privacy-safe not-found envelope for draft response detail and review', async () => {
    surveys.responseDetail.mockRejectedValueOnce(new NotFoundException('survey_response_not_found'));
    surveys.review.mockRejectedValueOnce(new NotFoundException('survey_response_not_found'));

    const detail = await request(app.getHttpServer()).get(`/api/admin/surveys/${surveyId}/responses/${responseId}`)
      .set('Cookie', 'soc_at=access-token').expect(404);
    const review = await request(app.getHttpServer()).post(`/api/admin/surveys/${surveyId}/responses/${responseId}/review`)
      .set('Cookie', 'soc_at=access-token')
      .send({ expectedSurveyRevisionId: '10000000-0000-4000-8000-000000000008', state: 'APPROVED' }).expect(404);

    expect(detail.body).toEqual({ code: 'survey_response_not_found', message: 'Request failed', requestId: expect.any(String) });
    expect(review.body).toEqual({ code: 'survey_response_not_found', message: 'Request failed', requestId: expect.any(String) });
  });
  it('propagates strict service errors through the standard envelope without exposing a guest phone', async () => {
    const guestPhone = '+821012345678';
    surveys.submit.mockRejectedValue(new UnprocessableEntityException({ code: 'invalid_survey_response', message: guestPhone }));
    const response = await request(app.getHttpServer()).post(`/api/surveys/${surveyId}/responses`).set('x-request-id', 'survey-phone-safe').send({ guestPhone }).expect(422);
    expect(response.body).toEqual({ code: 'invalid_survey_response', message: 'Request failed', requestId: 'survey-phone-safe' });
    expect(response.text).not.toContain(guestPhone);
  });
});
