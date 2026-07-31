import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFaqApi, AdminFaqApiError } from '@/lib/admin-faq-api';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('admin FAQ API', () => {
  it('loads the complete admin FAQ model with credentials', async () => {
    const payload = { topics: [], items: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(adminFaqApi.list()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith('/api/admin/faqs', expect.objectContaining({ method: 'GET', credentials: 'include' }));
  });

  it('sends exact bilingual FAQ creation fields', async () => {
    const input = { topicId: 'topic-id', questionKr: '질문', questionEn: 'Question', answerKr: '답', answerEn: 'Answer', displayOrder: 0, status: 'PUBLISHED' as const };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'faq-id', ...input }), { status: 201 }));
    await adminFaqApi.createFaq(input);
    expect(fetch).toHaveBeenCalledWith('/api/admin/faqs', expect.objectContaining({ method: 'POST', body: JSON.stringify(input), credentials: 'include' }));
  });

  it('supports no-content deletion and exposes authorization failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(adminFaqApi.deleteFaq('faq/id')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/admin/faqs/faq%2Fid', expect.objectContaining({ method: 'DELETE' }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(adminFaqApi.list()).rejects.toBeInstanceOf(AdminFaqApiError);
  });
});
