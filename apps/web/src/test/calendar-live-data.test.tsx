import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { EventListResponse } from '@soc/contracts';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarPage } from '@/pages/calendar-page';

const getEventsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/event-api', () => ({ getEvents: getEventsMock }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-27T12:00:00+09:00'));
});

afterEach(() => {
  cleanup();
  getEventsMock.mockReset();
  vi.useRealTimers();
});

const renderCalendar = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>);

const today = new Date('2026-07-27T12:00:00+09:00');
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const calendarResponse: EventListResponse = {
  locale: 'ko',
  items: [
    {
      id: 'committee-meeting',
      title: { value: '전산학부 학생회 정기 회의', translationUnavailable: false },
      description: { value: '학부 구성원을 위한 행사 일정을 논의합니다.', translationUnavailable: false },
      startAtMs: Date.parse(`${todayKey}T00:00:00+09:00`),
      endAtMs: Date.parse(`${tomorrowKey}T00:00:00+09:00`),
      allDay: true,
      allDayStartDate: todayKey,
      allDayEndDate: tomorrowKey,
      location: 'N1 회의실',
      visibility: 'PUBLIC',
      updatedAt: '2026-07-27T00:00:00.000Z',
      surveyId: null,
    },
  ],
};

describe('CalendarPage live data', () => {
  it('requests the visible-month range and maps Korean backend events into the calendar', async () => {
    let resolve!: (response: EventListResponse) => void;
    getEventsMock.mockReturnValueOnce(new Promise<EventListResponse>((done) => { resolve = done; }));
    const expectedFrom = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const expectedTo = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

    renderCalendar();

    expect(screen.getByText('일정을 불러오는 중입니다')).toBeVisible();
    expect(screen.queryByText('선택한 날짜의 일정이 없습니다')).not.toBeInTheDocument();
    await waitFor(() => expect(getEventsMock).toHaveBeenCalledWith(expectedFrom, expectedTo));
    resolve(calendarResponse);

    expect((await screen.findAllByText('전산학부 학생회 정기 회의')).length).toBeGreaterThan(0);
    expect(screen.getByText('학부 구성원을 위한 행사 일정을 논의합니다.')).toBeVisible();
    expect(screen.getByText('N1 회의실')).toBeVisible();
  });
  it('maps non-null English DTO content into the calendar', async () => {
    getEventsMock.mockResolvedValueOnce({
      ...calendarResponse,
      locale: 'en',
      items: [{
        ...calendarResponse.items[0]!,
        title: { value: 'Computer Science Committee Meeting', translationUnavailable: false },
        description: { value: 'Discussing events for department members.', translationUnavailable: false },
      }],
    });

    renderCalendar();

    expect((await screen.findAllByText('Computer Science Committee Meeting')).length).toBeGreaterThan(0);
    expect(screen.getByText('Discussing events for department members.')).toBeVisible();
  });

  it('shows an explicit calendar API failure', async () => {
    getEventsMock.mockRejectedValueOnce(new Error('unavailable'));

    renderCalendar();

    expect(await screen.findByText('일정을 불러오지 못했습니다')).toBeVisible();
    expect(screen.queryByText('선택한 날짜의 일정이 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByText('전산학부 학생회 정기 회의')).not.toBeInTheDocument();
  });

  it('shows the visible-month empty state for an empty API response', async () => {
    getEventsMock.mockResolvedValueOnce({ locale: 'ko', items: [] } satisfies EventListResponse);

    renderCalendar();

    expect(await screen.findByText('이번 달 일정이 없습니다')).toBeVisible();
    expect(screen.queryByText('전산학부 학생회 정기 회의')).not.toBeInTheDocument();
  });
});
