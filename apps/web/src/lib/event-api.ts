import type { ContentLocale, EventItem, EventListResponse } from '@soc/contracts';

import { ApiClientError, getApiJson } from '@/lib/api-client';

const UPCOMING_EVENTS_RANGE_MS = 92 * 24 * 60 * 60 * 1000;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

const getAbortableApiJson = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new ApiClientError(response.status);
  return response.json() as Promise<T>;
};

export const getEvent = (id: string, locale: ContentLocale, signal?: AbortSignal): Promise<EventItem> => {
  const query = new URLSearchParams({ locale });
  return getAbortableApiJson<EventItem>(`/events/${encodeURIComponent(id)}?${query.toString()}`, signal);
};
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
