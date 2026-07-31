import { INestApplication, RequestMethod, UnprocessableEntityException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type {
  ContentMatcherDto,
  GetMySurveyResponseResponse,
  ReplaceSectionQuestionsRequest,
  SubmitSurveyResponse,
  SubmitSurveyResponseRequest,
  SurveyAggregateResponse,
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
import { UsersService } from '../src/features/users/users.service';

const actorId = '10000000-0000-4000-8000-000000000001';
const surveyId = '10000000-0000-4000-8000-000000000002';
const sectionId = '10000000-0000-4000-8000-000000000003';
const responseId = '10000000-0000-4000-8000-000000000004';
const matcherId = '10000000-0000-4000-8000-000000000005';

describe('Survey HTTP boundary', () => {
  let app: INestApplication;
  let surveys: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    const survey = {
      id: surveyId, revision: 1, locale: 'ko', title: { value: '설문', translationUnavailable: false }, description: null,
      state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null,
      editDeadlineAt: null, responseRetentionDays: 365, sections: [], updatedAt: '2026-07-27T00:00:00.000Z',
    } satisfies SurveyDto;
    const response = {
      id: responseId, state: 'SUBMITTED', answers: [{ questionId: 'question-1', textValue: 'answer' }],
      submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: true, maskedPhone: '010-****-5678',
    } satisfies SurveyResponseDto;
    const aggregate = {
      surveyId, responseCount: 5, suppressed: false,
      questions: [{ questionId: '10000000-0000-4000-8000-000000000006', suppressed: false, responseCount: 5, choices: [{ choiceOptionId: '10000000-0000-4000-8000-000000000007', count: 3 }] }],
    } satisfies SurveyAggregateResponse;
    const surveyExport = { filename: 'survey.csv', csv: '' };
    const matcher = {
      id: matcherId, articleId: surveyId, eventId: null, surveyId, createdAt: '2026-07-27T00:00:00.000Z',
    } satisfies ContentMatcherDto;
    surveys = {
      list: vi.fn().mockResolvedValue({ locale: 'ko', items: [survey] }), get: vi.fn().mockResolvedValue(survey),
      submit: vi.fn().mockResolvedValue({ status: 'ACCEPTED' } satisfies SubmitSurveyResponse), mine: vi.fn().mockResolvedValue({ response } satisfies GetMySurveyResponseResponse),
      create: vi.fn().mockResolvedValue(survey), patch: vi.fn().mockResolvedValue(survey), publish: vi.fn().mockResolvedValue({ survey }),
      sections: vi.fn().mockResolvedValue(survey), questions: vi.fn().mockResolvedValue(survey), review: vi.fn().mockResolvedValue(response),
      aggregate: vi.fn().mockResolvedValue(aggregate),
      export: vi.fn().mockResolvedValue(surveyExport),
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
    app = module.createNestApplication();
    app.use(cookieParser());
    const requestIdMiddleware = new RequestIdMiddleware();
    app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  const authenticated = (method: 'post' | 'patch' | 'put' | 'delete' | 'get', path: string) =>
    request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=access-token');

  it('exposes exactly the seventeen approved method/path operations and response bodies', async () => {
    const trace = 'survey-http-17';
    const guestPhone = '+821012345678';
    const excludedPhoneStorageFields = ['guestPhone', 'guestPhoneCiphertext', 'guestPhoneHash', 'guestPhoneHashVersion'];
    const detail = {
      id: surveyId, revision: 1, locale: 'ko', title: { value: '설문', translationUnavailable: false }, description: null,
      state: 'DRAFT', guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null,
      editDeadlineAt: null, responseRetentionDays: 365, sections: [], updatedAt: '2026-07-27T00:00:00.000Z',
    };
    const projectedResponse = {
      id: responseId, state: 'SUBMITTED', answers: [{ questionId: 'question-1', textValue: 'answer' }],
      submittedAt: '2026-07-27T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: true, maskedPhone: '010-****-5678',
    };
    const submission = { status: 'ACCEPTED' } satisfies SubmitSurveyResponse;
    const list = { locale: 'ko', items: [detail] };
    const aggregate = {
      surveyId, responseCount: 5, suppressed: false,
      questions: [{ questionId: '10000000-0000-4000-8000-000000000006', suppressed: false, responseCount: 5, choices: [{ choiceOptionId: '10000000-0000-4000-8000-000000000007', count: 3 }] }],
    } satisfies SurveyAggregateResponse;
    const matcher = { id: matcherId, articleId: surveyId, eventId: null, surveyId, createdAt: '2026-07-27T00:00:00.000Z' } satisfies ContentMatcherDto;
    const create = {
      title: { kr: '설문', en: 'Survey' }, description: { kr: '설명', en: 'Description' }, guestAllowed: true, phoneRequired: true,
      feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365,
    };
    const patch = { title: { kr: '수정', en: 'Updated' } };
    const sections = { sections: [{ ordinal: 0, title: { kr: '기본', en: 'Basics' } }] };
    const questions = { questions: [{
      ordinal: 0, prompt: { kr: '질문', en: 'Question' }, helpText: null, type: 'SINGLE_CHOICE', required: true,
      choices: [{ ordinal: 0, value: { kr: '예', en: 'Yes' } }],
    }] } satisfies ReplaceSectionQuestionsRequest;
    const routes: Array<{
      method: 'get' | 'post' | 'patch' | 'put' | 'delete';
      path: string;
      body?: string | object;
      status: number;
      expectedBody: object | '';
      phoneDerived?: boolean;
    }> = [
      { method: 'get', path: '/api/surveys', status: 200, expectedBody: list },
      { method: 'get', path: `/api/surveys/${surveyId}?locale=en`, status: 200, expectedBody: detail },
      { method: 'post', path: `/api/surveys/${surveyId}/responses`, body: { answers: [{ questionId: 'question-1', textValue: 'answer' }], guestPhone } satisfies SubmitSurveyResponseRequest, status: 201, expectedBody: submission, phoneDerived: true },
      { method: 'get', path: `/api/surveys/${surveyId}/responses/me`, status: 200, expectedBody: { response: projectedResponse }, phoneDerived: true },
      { method: 'post', path: '/api/admin/surveys', body: create, status: 201, expectedBody: detail },
      { method: 'patch', path: `/api/admin/surveys/${surveyId}`, body: patch, status: 200, expectedBody: detail },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/publish`, status: 201, expectedBody: { survey: detail } },
      { method: 'put', path: `/api/admin/surveys/${surveyId}/sections`, body: sections, status: 200, expectedBody: detail },
      { method: 'put', path: `/api/admin/sections/${sectionId}/questions`, body: questions, status: 200, expectedBody: detail },
      { method: 'post', path: `/api/admin/survey-responses/${responseId}/review`, body: { state: 'APPROVED', reason: null }, status: 201, expectedBody: projectedResponse, phoneDerived: true },
      { method: 'get', path: `/api/admin/surveys/${surveyId}/aggregate`, status: 200, expectedBody: aggregate },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/export`, body: { format: 'CSV' }, status: 200, expectedBody: '' },
      { method: 'post', path: '/api/admin/content-matchers', body: { articleId: surveyId, surveyId }, status: 201, expectedBody: matcher },
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
      'DELETE /api/admin/content-matchers/:id', 'GET /api/admin/survey-responses/:id',
      'GET /api/admin/surveys/:id/aggregate', 'GET /api/admin/surveys/:id/responses',
      'GET /api/surveys', 'GET /api/surveys/:id', 'GET /api/surveys/:id/responses/me',
      'GET /api/surveys/responses/me', 'PATCH /api/admin/surveys/:id', 'POST /api/admin/content-matchers',
      'POST /api/admin/survey-responses/:id/review', 'POST /api/admin/surveys', 'POST /api/admin/surveys/:id/export',
      'POST /api/admin/surveys/:id/publish', 'POST /api/surveys/:id/responses',
      'PUT /api/admin/sections/:id/questions', 'PUT /api/admin/surveys/:id/sections',
    ]);

    for (const route of routes) {
      const response = request(app.getHttpServer())[route.method](route.path).set('x-request-id', trace);
      if (route.path.includes('/admin/') || route.path.endsWith('/responses/me')) response.set('Cookie', 'soc_at=access-token');
      const actual = await (route.body === undefined ? response : response.send(route.body)).expect(route.status);

      if (route.expectedBody === '') {
        expect(actual.text).toBe('');
      } else {
        expect(actual.body).toEqual(route.expectedBody);
        if (route.phoneDerived) {
          expect(actual.text).not.toContain(guestPhone);
          for (const field of excludedPhoneStorageFields) expect(actual.text).not.toContain(field);
        }
      }
    }

    expect(surveys.list).toHaveBeenCalledWith(undefined, 'ko');
    expect(surveys.get).toHaveBeenCalledWith(undefined, surveyId, 'en');
    expect(surveys.submit).toHaveBeenCalledWith(undefined, surveyId, { answers: [{ questionId: 'question-1', textValue: 'answer' }], guestPhone }, trace);
    expect(surveys.mine).toHaveBeenCalledWith(actorId, surveyId);
    expect(surveys.create).toHaveBeenCalledWith(actorId, create, trace);
    expect(surveys.patch).toHaveBeenCalledWith(actorId, surveyId, patch, trace);
    expect(surveys.publish).toHaveBeenCalledWith(actorId, surveyId, trace);
    expect(surveys.sections).toHaveBeenCalledWith(actorId, surveyId, sections, trace);
    expect(surveys.questions).toHaveBeenCalledWith(actorId, sectionId, questions, trace);
    expect(surveys.review).toHaveBeenCalledWith(actorId, responseId, { state: 'APPROVED', reason: null }, trace);
    expect(surveys.aggregate).toHaveBeenCalledWith(actorId, surveyId);
    expect(surveys.export).toHaveBeenCalledWith(actorId, surveyId, { format: 'CSV' }, trace);
    expect(surveys.matcher).toHaveBeenCalledWith(actorId, { articleId: surveyId, surveyId }, trace);
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
      { method: 'put', path: '/api/admin/surveys/not-a-uuid/sections', authenticated: true },
      { method: 'put', path: '/api/admin/sections/not-a-uuid/questions', authenticated: true },
      { method: 'post', path: '/api/admin/survey-responses/not-a-uuid/review', authenticated: true },
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
    const aliases: Array<{ method: 'get' | 'post'; path: string }> = [
      { method: 'get', path: '/api/survey' },
      { method: 'post', path: `/api/surveys/${surveyId}/response` },
      { method: 'post', path: `/api/admin/surveys/${surveyId}/responses` },
      { method: 'post', path: '/api/admin/survey-matchers' },
    ];
    for (const alias of aliases) await request(app.getHttpServer())[alias.method](alias.path).send({}).expect(404);
    for (const service of Object.values(surveys)) expect(service).not.toHaveBeenCalled();
  });

  it('propagates strict service errors through the standard envelope without exposing a guest phone', async () => {
    const guestPhone = '+821012345678';
    surveys.submit.mockRejectedValue(new UnprocessableEntityException({ code: 'invalid_survey_response', message: guestPhone }));
    const response = await request(app.getHttpServer()).post(`/api/surveys/${surveyId}/responses`).set('x-request-id', 'survey-phone-safe').send({ guestPhone }).expect(422);
    expect(response.body).toEqual({ code: 'invalid_survey_response', message: 'Request failed', requestId: 'survey-phone-safe' });
    expect(response.text).not.toContain(guestPhone);
  });
});
