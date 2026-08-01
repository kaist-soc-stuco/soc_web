import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventItem } from '@soc/contracts';
import { adminEventApi } from '../lib/admin-event-api';

const DAY_MS = 24 * 60 * 60 * 1000;
const event = (id: string, startAtMs: number): EventItem => ({
  id,
  title: { value: id, translationUnavailable: false },
  description: { value: '', translationUnavailable: false },
  startAtMs,
  endAtMs: startAtMs + DAY_MS,
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  location: '',
  visibility: 'PUBLIC',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

afterEach(() => vi.restoreAllMocks());

describe('adminEventApi.list', () => {
  it('loads the two-year window in API-safe ranges and deduplicates boundary-spanning events', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 1));
    const shared = event('shared', Date.UTC(2026, 0, 1));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      const fromMs = Number(url.searchParams.get('fromMs'));
      return new Response(JSON.stringify({ locale: 'ko', items: [shared, event(String(fromMs), fromMs)] }), { status: 200 });
    });

    const result = await adminEventApi.list();

    expect(fetchMock).toHaveBeenCalledTimes(8);
    const ranges = fetchMock.mock.calls.map(([input]) => {
      const url = new URL(String(input), 'http://localhost');
      return [Number(url.searchParams.get('fromMs')), Number(url.searchParams.get('toMs'))] as const;
    });
    expect(ranges.every(([fromMs, toMs]) => toMs - fromMs <= 92 * DAY_MS)).toBe(true);
    expect(ranges.slice(1).every(([fromMs], index) => fromMs === ranges[index][1])).toBe(true);
    expect(result.items.filter((item) => item.id === shared.id)).toHaveLength(1);
    expect(result.items.map((item) => item.startAtMs)).toEqual([...result.items].map((item) => item.startAtMs).sort((a, b) => a - b));
  });
});
