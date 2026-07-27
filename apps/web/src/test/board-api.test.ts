import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardApiError, BoardApiProtocolError, boardApi } from '../lib/board-api';

const summary = { id: 'a', boardCode: 'notice', title: { value: '공지', translationUnavailable: false }, status: 'PUBLISHED', scope: 'ALL', isPinned: false, pinnedOrder: null, publishedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' };
const board = { id: 'b', code: 'notice', title: { value: '공지', translationUnavailable: false }, description: { value: '', translationUnavailable: false }, config: { readPermission: 'PUBLIC', writePermission: 'COMMITTEE', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 1, isHidden: false, showOnHome: true }, updatedAt: '2026-01-01T00:00:00.000Z' };

afterEach(() => vi.restoreAllMocks());
describe('boardApi', () => {
  it('uses credentialed requests and typed board/article endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ locale: 'ko', items: [{ ...board, latestArticles: [summary] }] }), { status: 200 }));
    await boardApi.list({ home: true, latestLimit: 1, locale: 'ko' });
    expect(fetchMock).toHaveBeenCalledWith('/api/boards?home=true&latestLimit=1&locale=ko', expect.objectContaining({ credentials: 'include', method: 'GET' }));
  });
  it('maps canonical API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'board_not_found', message: 'missing', requestId: 'r' }), { status: 404 }));
    await expect(boardApi.articles('missing')).rejects.toMatchObject({ status: 404, code: 'board_not_found', message: 'missing' });
    await expect(boardApi.articles('missing')).rejects.toBeInstanceOf(BoardApiError);
  });
  it('rejects malformed successful payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ locale: 'ko', items: [] }), { status: 200 }));
    await expect(boardApi.get('notice')).rejects.toBeInstanceOf(BoardApiProtocolError);
  });
});
