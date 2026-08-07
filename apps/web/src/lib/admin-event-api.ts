import type { AdminEvent, CreateEventRequest, EventListResponse, PatchEventRequest } from '@soc/contracts';
const base = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> { const response = await fetch(`${base}${path}`, { method, credentials: 'include', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.status === 204 ? undefined as T : response.json() as Promise<T>; }
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVENT_RANGE_MS = 92 * DAY_MS;

async function listEvents(): Promise<EventListResponse> {
  const fromMs = Date.now() - 365 * DAY_MS;
  const toMs = Date.now() + 365 * DAY_MS;
  const pages: EventListResponse[] = [];

  for (let pageFrom = fromMs; pageFrom < toMs; pageFrom += MAX_EVENT_RANGE_MS) {
    const pageTo = Math.min(pageFrom + MAX_EVENT_RANGE_MS, toMs);
    const query = new URLSearchParams({ fromMs: String(pageFrom), toMs: String(pageTo), locale: 'ko' });
    pages.push(await request<EventListResponse>(`/events?${query}`));
  }

  const items = [...new Map(pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()]
    .sort((left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id));
  return { locale: 'ko', items };
}
export const adminEventApi = {
  list: listEvents,
  get: (id: string) => request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`),
  create: (input: CreateEventRequest) => request<AdminEvent>('/admin/events', 'POST', input),
  patch: (id: string, input: PatchEventRequest) => request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, 'PATCH', input),
  delete: (id: string) => request<void>(`/admin/events/${encodeURIComponent(id)}`, 'DELETE'),
};
