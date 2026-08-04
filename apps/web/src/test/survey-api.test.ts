import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyApiError, SurveyApiProtocolError, surveyApi } from '@/lib/survey-api';

describe('survey API transport contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects malformed successful survey DTOs instead of exposing unchecked data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'survey-1' }), { status: 200 })));

    await expect(surveyApi.get('survey-1')).rejects.toBeInstanceOf(SurveyApiProtocolError);
  });

  it('rejects malformed successful guest acceptance DTOs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ACCEPTED', response: {} }), { status: 200 })));

    await expect(surveyApi.submit('survey-1', { answers: [] })).rejects.toBeInstanceOf(SurveyApiProtocolError);
  });

  it('preserves canonical error envelopes including request IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'invalid_definition', message: 'Invalid definition', requestId: 'request-1' }), { status: 422 })));

    await expect(surveyApi.submit('survey-1', { answers: [] })).rejects.toEqual(expect.objectContaining<Partial<SurveyApiError>>({
      status: 422,
      code: 'invalid_definition',
      requestId: 'request-1',
    }));
  });
  it('rejects malformed error DTOs without trusting their fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 42, message: null }), { status: 422 })));
    await expect(surveyApi.submit('survey-1', { answers: [] })).rejects.toEqual(expect.objectContaining<Partial<SurveyApiError>>({ status: 422, code: undefined, requestId: undefined }));
  });
  it('sends a complete definition replacement with the expected CAS version', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'stale_definition', message: 'Stale definition', requestId: 'request-2' }), { status: 409 }));
    vi.stubGlobal('fetch', fetch);

    await expect(surveyApi.replaceDefinition('survey-1', { expectedDefinitionVersion: 3, sections: [] })).rejects.toEqual(expect.objectContaining({ code: 'stale_definition', requestId: 'request-2' }));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/surveys/survey-1/definition'), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ expectedDefinitionVersion: 3, sections: [] }) }));
  });

  it('decodes canonical JSON export errors and preserves their request ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'export_unavailable', message: 'Export unavailable', requestId: 'request-3' }), { status: 413 })));

    await expect(surveyApi.export('survey-1', { format: 'CSV' })).rejects.toEqual(expect.objectContaining({ status: 413, code: 'export_unavailable', requestId: 'request-3' }));
  });
  it('clears stale authentication cookies through the idempotent logout endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);

    await expect(surveyApi.clearSession()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });
  it('serializes selected locales for both admin survey list resources', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(surveyApi.listAdmin(undefined, 'en')).rejects.toBeInstanceOf(SurveyApiProtocolError);
    await expect(surveyApi.reviewQueue(undefined, 'ko')).rejects.toBeInstanceOf(SurveyApiProtocolError);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/admin/surveys?locale=en'), expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/admin/surveys/review-queue?locale=ko'), expect.objectContaining({ method: 'GET' }));
  });
  it('decodes typed relationship metadata and sends survey-period synchronization intent', async () => {
    const relation = {
      id: '10000000-0000-4000-8000-000000000001',
      articleId: null,
      eventId: '10000000-0000-4000-8000-000000000002',
      surveyId: '10000000-0000-4000-8000-000000000003',
      relationType: 'SURVEY_PERIOD',
      syncMode: 'SURVEY_TO_EVENT',
      createdByUserId: '10000000-0000-4000-8000-000000000004',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedByUserId: '10000000-0000-4000-8000-000000000004',
      updatedAt: '2026-08-01T00:00:00.000Z',
      synchronizedAt: '2026-08-01T00:00:00.000Z',
    };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [relation] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(relation), { status: 201 }));
    vi.stubGlobal('fetch', fetch);

    await expect(surveyApi.relations({ surveyId: relation.surveyId })).resolves.toEqual({ items: [relation] });
    await expect(surveyApi.createRelation({ eventId: relation.eventId, surveyId: relation.surveyId, relationType: 'SURVEY_PERIOD', syncMode: 'SURVEY_TO_EVENT' })).resolves.toEqual(relation);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining(`/admin/content-matchers?surveyId=${relation.surveyId}`), expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/admin/content-matchers'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ eventId: relation.eventId, surveyId: relation.surveyId, relationType: 'SURVEY_PERIOD', syncMode: 'SURVEY_TO_EVENT' }),
    }));
  });
  it('strictly decodes ordered section items without exposing provider storage details', async () => {
    const surveyId = '10000000-0000-4000-8000-000000000001';
    const payload = {
      id: surveyId, revision: 1, definitionVersion: 1, locale: 'ko',
      requestedLocale: 'ko', effectiveContentLocale: 'ko', onlyForKoreanSpeaker: false,
      title: { value: '설문', translationUnavailable: false }, description: null, state: 'OPEN',
      guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null,
      opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365,
      sections: [{ id: '10000000-0000-4000-8000-000000000003', ordinal: 0, title: { value: '섹션', translationUnavailable: false }, items: [
        { id: '10000000-0000-4000-8000-000000000004', ordinal: 0, kind: 'DESCRIPTION', body: { value: '안내', translationUnavailable: false } },
        { id: '10000000-0000-4000-8000-000000000005', ordinal: 1, kind: 'IMAGE_BLOCK', mode: 'SHARED', membershipCounts: { shared: 1, ko: 0, en: 0 } },
      ] }],
      updatedAt: '2026-08-03T00:00:00.000Z',
    };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(surveyApi.get(surveyId, 'ko')).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/surveys/${surveyId}?locale=ko`), expect.objectContaining({ method: 'GET' }));
    expect(JSON.stringify(payload)).not.toMatch(/objectKey|provider|uploadUrl|token|presentationBlocks/);
  });
  it('sends incremental membership moves and mode conversions to their admin routes', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ definitionVersion: 2, membership: null, membershipCount: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ definitionVersion: 3, mode: 'SHARED', membershipCounts: { shared: 1, ko: 0, en: 0 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await surveyApi.moveImageMembership('survey-1', 'block-1', 'membership-1', { expectedDefinitionVersion: 1, clientMutationId: '10000000-0000-4000-8000-000000000001', afterMembershipId: null });
    await surveyApi.changeImageBlockMode('survey-1', 'block-1', { expectedDefinitionVersion: 2, clientMutationId: '10000000-0000-4000-8000-000000000002', mode: 'SHARED', retainSet: 'KO' });
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/admin/surveys/survey-1/image-blocks/block-1/memberships/membership-1'), expect.objectContaining({ method: 'PATCH' }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/admin/surveys/survey-1/image-blocks/block-1/mode'), expect.objectContaining({ method: 'POST' }));
  });
});
