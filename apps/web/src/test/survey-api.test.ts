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
});
