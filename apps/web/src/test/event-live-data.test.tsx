import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EventListResponse } from '@soc/contracts';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventCarousel } from '@/components/organisms/event-carousel';
import { EventsPage } from '@/pages/events-page';

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

afterEach(() => {
  cleanup();
  getEventsMock.mockReset();
  getUpcomingEventsMock.mockReset();
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

  it('renders event-page API data rather than mock event cards', async () => {
    getEventsMock.mockResolvedValueOnce(eventResponse);

    renderEventsPage();

    expect(await screen.findByRole('heading', { name: '2026 신입생 오리엔테이션' })).toBeVisible();
    expect(screen.getByText('전산학부 신입생을 위한 안내 행사입니다.')).toBeVisible();
    expect(screen.queryByText('2026 봄맞이 간식 이벤트')).not.toBeInTheDocument();
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

  it('keeps survey cards available when an event request is pending', async () => {
    getEventsMock.mockReturnValueOnce(new Promise<EventListResponse>(() => {}));
    renderEventsPage();

    expect(screen.getByText('행사를 불러오는 중입니다')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '설문조사' }));

    expect((await screen.findAllByRole('heading', { name: '2026 봄맞이 간식 이벤트' })).length).toBeGreaterThan(0);
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
