import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LegacyEventSurveyResolver } from '@/App';

const getEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/event-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/event-api')>()),
  getEvent,
}));

const event = (surveyId?: string | null) => ({
  id: '10000000-0000-4000-8000-000000000001',
  title: { value: '행사', translationUnavailable: false },
  description: { value: '설명', translationUnavailable: false },
  startAtMs: 0,
  endAtMs: 1,
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  location: 'Room',
  visibility: 'PUBLIC' as const,
  updatedAt: '2026-07-27T00:00:00.000Z',
  ...(surveyId === undefined ? {} : { surveyId }),
});

const SurveyTarget = () => {
  const { surveyId } = useParams<{ surveyId?: string }>();
  return <p>survey target: {surveyId ?? 'missing'}</p>;
};

const renderResolver = () => render(
  <MemoryRouter initialEntries={['/events/10000000-0000-4000-8000-000000000001/survey']}>
    <Routes>
      <Route path="/events/:eventId/survey" element={<LegacyEventSurveyResolver />} />
      <Route path="/survey/:surveyId" element={<SurveyTarget />} />
    </Routes>
  </MemoryRouter>,
);

afterEach(() => {
  cleanup();
  getEvent.mockReset();
});

describe('legacy event survey route', () => {
  it('resolves an event matcher and redirects to the actual survey id', async () => {
    getEvent.mockResolvedValue(event('20000000-0000-4000-8000-000000000002'));
    renderResolver();

    expect(await screen.findByText('survey target: 20000000-0000-4000-8000-000000000002')).toBeVisible();
    expect(getEvent).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      'ko',
      expect.any(AbortSignal),
    );
  });

  it('reports a visible unavailable state when no matcher exists', async () => {
    getEvent.mockResolvedValue(event(null));
    renderResolver();

    expect(await screen.findByText('연결된 설문을 찾을 수 없습니다.')).toBeVisible();
    expect(screen.queryByText(/survey target:/)).not.toBeInTheDocument();
  });

  it('reports a stable load error without guessing a survey id', async () => {
    getEvent.mockRejectedValue(new Error('network'));
    renderResolver();

    expect(await screen.findByText('설문 정보를 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByText(/survey target:/)).not.toBeInTheDocument();
  });
});
