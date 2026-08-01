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

  it('maps a malformed error DTO to a status-only API error without trusting its fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 42, message: null }), { status: 422 })));

    await expect(surveyApi.submit('survey-1', { answers: [] })).rejects.toEqual(expect.objectContaining<Partial<SurveyApiError>>({
      status: 422,
      code: undefined,
    }));
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
});
