import type { EventListResponse } from '@soc/contracts';

import { getApiJson } from '@/lib/api-client';

const UPCOMING_EVENTS_RANGE_MS = 92 * 24 * 60 * 60 * 1000;
export const getEvents = (fromMs: number, toMs: number): Promise<EventListResponse> => {
  const query = new URLSearchParams({
    fromMs: String(fromMs),
    toMs: String(toMs),
    locale: 'ko',
  });

  return getApiJson<EventListResponse>(`/events?${query.toString()}`);
};

export const getUpcomingEvents = (now = Date.now()): Promise<EventListResponse> => {
  const query = new URLSearchParams({
    fromMs: String(now),
    toMs: String(now + UPCOMING_EVENTS_RANGE_MS),
    locale: 'ko',
  });

  return getApiJson<EventListResponse>(`/events?${query.toString()}`);
};
