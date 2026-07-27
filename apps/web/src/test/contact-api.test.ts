import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContactApiError, ContactApiProtocolError, contactApi } from '@/lib/contact-api';

const contact = (projection: 'MASKED' | 'FULL' = 'FULL') => ({
  id: 'contact-1', projection, name: '홍길동', email: 'hong@example.test', phone: '010-1234-5678', affiliation: 'KAIST', note: projection === 'FULL' ? '메모' : null,
  kaistUid: 'hong', year: '2026', role: '위원', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  retentionDeadlineAt: '2027-01-01T00:00:00.000Z', holdUntil: null,
});

const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });

describe('contact API transport contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects malformed successful contact list and mutation envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ items: [contact()], nextCursor: null, extra: true }))
      .mockResolvedValueOnce(response({ contact: { ...contact(), note: null, ciphertext: 'never expose' } }))
      .mockResolvedValueOnce(response({ ok: false, code: 'feature_disabled' }))
      .mockResolvedValueOnce(response({ kind: 'EXTERNAL_LINK_NOTICE', externalUrl: 'https://chat.example.test', notice: 7 })));

    await expect(contactApi.list()).rejects.toBeInstanceOf(ContactApiProtocolError);
    await expect(contactApi.create({ name: '홍길동', role: null, email: null, phone: null, affiliation: null, note: null, kaistUid: null, year: null })).rejects.toBeInstanceOf(ContactApiProtocolError);
    await expect(contactApi.mailPreview({ contactIds: [], subject: '', body: '' })).rejects.toBeInstanceOf(ContactApiProtocolError);
    await expect(contactApi.chatPage()).rejects.toBeInstanceOf(ContactApiProtocolError);
  });

  it('rejects malformed error envelopes without trusting their fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ code: 503, message: null, requestId: 1 }, 503)));

    await expect(contactApi.chatMessage({ body: 'hello' })).rejects.toEqual(expect.objectContaining<Partial<ContactApiError>>({
      status: 503,
      code: undefined,
    }));
  });

  it('sends exact encoded paths, bodies, and credentials at the API boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ contact: contact() }));
    vi.stubGlobal('fetch', fetchMock);

    await contactApi.patch('id /?', { name: ' 새 이름 ', role: null, email: null, phone: null, affiliation: null, note: null, kaistUid: null, year: null });

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/contacts/id%20%2F%3F', expect.objectContaining({
      method: 'PATCH', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ' 새 이름 ', role: null, email: null, phone: null, affiliation: null, note: null, kaistUid: null, year: null }),
    }));
  });
});
