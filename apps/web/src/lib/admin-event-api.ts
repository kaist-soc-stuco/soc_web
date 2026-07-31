import type { AdminEvent, CreateEventRequest, EventListResponse, PatchEventRequest } from '@soc/contracts';
const base = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> { const response = await fetch(`${base}${path}`, { method, credentials: 'include', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.status === 204 ? undefined as T : response.json() as Promise<T>; }
export const adminEventApi = {
  list: () => { const query = new URLSearchParams({ fromMs: String(Date.now() - 365 * 86400000), toMs: String(Date.now() + 365 * 86400000), locale: 'ko' }); return request<EventListResponse>(`/events?${query}`); },
  create: (input: CreateEventRequest) => request<AdminEvent>('/admin/events', 'POST', input),
  patch: (id: string, input: PatchEventRequest) => request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, 'PATCH', input),
  delete: (id: string) => request<void>(`/admin/events/${encodeURIComponent(id)}`, 'DELETE'),
};
