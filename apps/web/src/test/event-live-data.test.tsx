import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EventListResponse } from '@soc/contracts';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventCarousel } from '@/components/organisms/event-carousel';
import { EventsPage } from '@/pages/events-page';
import { surveyApi } from '@/lib/survey-api';

const getEventsMock = vi.hoisted(() => vi.fn());
const getUpcomingEventsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/event-api', () => ({
  getEvents: getEventsMock,
  getUpcomingEvents: getUpcomingEventsMock,
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});
afterAll(() => {
  vi.unstubAllGlobals();
});


afterEach(() => {
  cleanup();
  getEventsMock.mockReset();
  getUpcomingEventsMock.mockReset();
  vi.restoreAllMocks();
});

const eventResponse: EventListResponse = {
  locale: 'ko',
  items: [
    {
      id: 'orientation',
      title: { value: '2026 신입생 오리엔테이션', translationUnavailable: false },
      description: { value: '전산학부 신입생을 위한 안내 행사입니다.', translationUnavailable: false },
      startAtMs: new Date('2026-08-01T09:00:00+09:00').getTime(),
      endAtMs: new Date('2026-08-01T12:00:00+09:00').getTime(),
      allDay: false,
      allDayStartDate: null,
      allDayEndDate: null,
      location: 'N1 101호',
      visibility: 'PUBLIC',
      updatedAt: '2026-07-27T00:00:00.000Z',
      surveyId: null,
    },
  ],
};

const renderEventsPage = () => render(<MemoryRouter initialEntries={['/events?type=event']}><EventsPage /></MemoryRouter>);

describe('event live data', () => {
  it('renders carousel loading followed by Korean upcoming-event API content', async () => {
    let resolve!: (response: EventListResponse) => void;
    getUpcomingEventsMock.mockReturnValueOnce(new Promise<EventListResponse>((done) => { resolve = done; }));

    render(<MemoryRouter><EventCarousel /></MemoryRouter>);

    expect(screen.getByText('행사를 불러오는 중입니다.')).toBeVisible();
    resolve(eventResponse);

    expect(await screen.findByText('2026 신입생 오리엔테이션')).toBeVisible();
    expect(screen.getByText('전산학부 신입생을 위한 안내 행사입니다.')).toBeVisible();
  });
  it('maps non-null English DTO content into the event carousel', async () => {
    getUpcomingEventsMock.mockResolvedValueOnce({
      ...eventResponse,
      locale: 'en',
      items: [{
        ...eventResponse.items[0]!,
        title: { value: 'Freshman Orientation 2026', translationUnavailable: false },
        description: { value: 'Orientation for incoming computer science students.', translationUnavailable: false },
      }],
    });

    render(<MemoryRouter><EventCarousel /></MemoryRouter>);

    expect(await screen.findByText('Freshman Orientation 2026')).toBeVisible();
    expect(screen.getByText('Orientation for incoming computer science students.')).toBeVisible();
  });


  it('renders event-page API data rather than mock event cards', async () => {
    getEventsMock.mockResolvedValueOnce(eventResponse);

    renderEventsPage();

    expect(await screen.findByRole('heading', { name: '2026 신입생 오리엔테이션' })).toBeVisible();
    expect(screen.getByText('전산학부 신입생을 위한 안내 행사입니다.')).toBeVisible();
    expect(screen.queryByText('2026 봄맞이 간식 이벤트')).not.toBeInTheDocument();
  });
  it('maps non-null English DTO content into event cards', async () => {
    getEventsMock.mockResolvedValueOnce({
      ...eventResponse,
      locale: 'en',
      items: [{
        ...eventResponse.items[0]!,
        title: { value: 'Freshman Orientation 2026', translationUnavailable: false },
        description: { value: 'Orientation for incoming computer science students.', translationUnavailable: false },
      }],
    });

    renderEventsPage();

    expect(await screen.findByRole('heading', { name: 'Freshman Orientation 2026' })).toBeVisible();
    expect(screen.getByText('Orientation for incoming computer science students.')).toBeVisible();
  });

  it('keeps the event surface explicit for API failures and empty results', async () => {
    getEventsMock.mockRejectedValueOnce(new Error('unavailable'));
    const { unmount } = renderEventsPage();

    expect(await screen.findByText('행사를 불러오지 못했습니다')).toBeVisible();
    expect(screen.queryByText('2026 봄맞이 간식 이벤트')).not.toBeInTheDocument();
    unmount();

    getEventsMock.mockResolvedValueOnce({ locale: 'ko', items: [] } satisfies EventListResponse);
    renderEventsPage();

    expect(await screen.findByText('행사가 없습니다')).toBeVisible();
    expect(screen.queryByText('2026 봄맞이 간식 이벤트')).not.toBeInTheDocument();
  });
  it('links survey cards directly to the canonical survey route', async () => {
    vi.spyOn(surveyApi, 'list').mockResolvedValueOnce({
      locale: 'ko',
      items: [{
        id: 'survey-1',
        revision: 1,
        locale: 'ko',
        title: { value: '학생 설문', translationUnavailable: false },
        description: { value: '의견을 남겨 주세요.', translationUnavailable: false },
        state: 'OPEN',
        guestAllowed: false,
        phoneRequired: false,
        feeRestriction: 'ANY',
        cap: null,
        opensAt: null,
        closesAt: null,
        editDeadlineAt: null,
        responseRetentionDays: 30,
        sections: [],
        updatedAt: '2026-08-01T00:00:00.000Z',
      }],
    });

    render(<MemoryRouter initialEntries={['/events?type=survey']}><EventsPage /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /학생 설문/ })).toHaveAttribute('href', '/survey/survey-1');
  });

  it('does not retain survey mock cards when an event request is pending', async () => {
    getEventsMock.mockReturnValueOnce(new Promise<EventListResponse>(() => {}));
    renderEventsPage();

    expect(screen.getByText('행사를 불러오는 중입니다')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '설문조사' }));

    expect(screen.queryByText('2026 봄맞이 간식 이벤트')).not.toBeInTheDocument();
    expect(screen.queryByText('행사를 불러오는 중입니다')).not.toBeInTheDocument();
  });

  it('renders translation-unavailable content explicitly', async () => {
    getEventsMock.mockResolvedValueOnce({
      ...eventResponse,
      items: [{
        ...eventResponse.items[0]!,
        title: { value: null, translationUnavailable: true },
        description: { value: null, translationUnavailable: true },
      }],
    });
    renderEventsPage();

    expect((await screen.findAllByText('번역이 제공되지 않습니다.')).length).toBeGreaterThanOrEqual(2);
  });

  it('renders explicit carousel error and empty states', async () => {
    getUpcomingEventsMock.mockRejectedValueOnce(new Error('unavailable'));
    const { unmount } = render(<MemoryRouter><EventCarousel /></MemoryRouter>);
    expect(await screen.findByText('행사를 불러오지 못했습니다.')).toBeVisible();
    unmount();

    getUpcomingEventsMock.mockResolvedValueOnce({ locale: 'ko', items: [] } satisfies EventListResponse);
    render(<MemoryRouter><EventCarousel /></MemoryRouter>);
    expect(await screen.findByText('예정된 행사가 없습니다.')).toBeVisible();
  });
});
