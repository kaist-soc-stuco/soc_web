import type { AdminFaq, AdminFaqListResponse, AdminFaqTopic, CreateFaqRequest, CreateFaqTopicRequest, PatchFaqRequest, PatchFaqTopicRequest, ReorderFaqTopicRequest } from '@soc/contracts';

const base = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
export class AdminFaqApiError extends Error { constructor(public readonly status: number) { super('FAQ 관리 요청에 실패했습니다.'); } }

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, { method, credentials: 'include', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new AdminFaqApiError(response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const adminFaqApi = {
  list: () => request<AdminFaqListResponse>('/admin/faqs'),
  createTopic: (input: CreateFaqTopicRequest) => request<AdminFaqTopic>('/admin/faq-topics', 'POST', input),
  patchTopic: (id: string, input: PatchFaqTopicRequest) => request<AdminFaqTopic>(`/admin/faq-topics/${encodeURIComponent(id)}`, 'PATCH', input),
  reorderTopic: (id: string, input: ReorderFaqTopicRequest) => request<AdminFaqTopic>(`/admin/faq-topics/${encodeURIComponent(id)}/order`, 'PUT', input),
  deleteTopic: (id: string) => request<void>(`/admin/faq-topics/${encodeURIComponent(id)}`, 'DELETE'),
  createFaq: (input: CreateFaqRequest) => request<AdminFaq>('/admin/faqs', 'POST', input),
  patchFaq: (id: string, input: PatchFaqRequest) => request<AdminFaq>(`/admin/faqs/${encodeURIComponent(id)}`, 'PATCH', input),
  deleteFaq: (id: string) => request<void>(`/admin/faqs/${encodeURIComponent(id)}`, 'DELETE'),
};
