import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardApiError, BoardApiProtocolError, boardApi } from '../lib/board-api';

const summary = { id: 'a', publicNo: 1, boardCode: 'notice', title: { value: '공지', translationUnavailable: false }, status: 'PUBLISHED', scope: 'ALL', isPinned: false, pinnedOrder: null, publishedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' };
const board = { id: 'b', code: 'notice', title: { value: '공지', translationUnavailable: false }, description: { value: '', translationUnavailable: false }, config: { readPermission: 'PUBLIC', writePermission: 'COMMITTEE', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 1, isHidden: false, showOnHome: true }, updatedAt: '2026-01-01T00:00:00.000Z' };

const adminBoard = { id: 'board-1', code: 'notice', titleKr: '공지', titleEn: 'Notice', descriptionKr: '설명', descriptionEn: 'Description', readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 1, isHidden: false, showOnHome: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };
const asset = { id: '10000000-0000-4000-8000-000000000001', articleId: '10000000-0000-4000-8000-000000000002', displayOrder: 0, type: 'ATTACHMENT', status: 'INITIATED', contentType: 'text/plain', byteSize: 3, checksumSha256: null, completedAt: null };
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
  it('strictly decodes administrative responses and sends versioned mutation bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [adminBoard] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(adminBoard), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(boardApi.adminList()).resolves.toEqual({ items: [adminBoard] });
    await expect(boardApi.adminPatch('board-1', { expectedUpdatedAt: adminBoard.updatedAt, titleKr: '새 공지' })).resolves.toEqual(adminBoard);
    await expect(boardApi.adminDelete('board-1', { expectedUpdatedAt: adminBoard.updatedAt })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/boards/board-1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ expectedUpdatedAt: adminBoard.updatedAt, titleKr: '새 공지' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/admin/boards/board-1', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt: adminBoard.updatedAt }) }));
  });
  it('runs the initiated upload and completion flow', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset, uploadUrl: 'https://uploads.example.test/object', uploadHeaders: { 'x-upload': 'token' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...asset, status: 'COMPLETED', completedAt: '2026-01-01T00:00:00.000Z' }), { status: 200 }));
    const initiated = await boardApi.initiateAsset(asset.articleId, { displayOrder: 0, type: 'ATTACHMENT', contentType: 'text/plain', byteSize: 3 });
    await boardApi.uploadAsset(initiated.uploadUrl, initiated.uploadHeaders, new File(['abc'], 'a.txt', { type: 'text/plain' }));
    await expect(boardApi.completeAsset(asset.id)).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://uploads.example.test/object', expect.objectContaining({ method: 'PUT', headers: { 'x-upload': 'token' } }));
  });

  it('rejects permissive-looking admin payloads and preserves canonical mutation errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ ...adminBoard, unexpected: true }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'stale_board', message: 'stale', requestId: 'r' }), { status: 409 }));
    await expect(boardApi.adminList()).rejects.toBeInstanceOf(BoardApiProtocolError);
    await expect(boardApi.adminPatch('board-1', { expectedUpdatedAt: adminBoard.updatedAt })).rejects.toMatchObject({ status: 409, code: 'stale_board', message: 'stale' });
  });
});
  it('rejects malformed public config and accepts nullable localized content', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ locale: 'ko', items: [{ ...board, config: { ...board.config, commentsAllowed: 'true' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ locale: 'en', items: [{ ...board, title: { value: null, translationUnavailable: true }, description: { value: null, translationUnavailable: true } }] }), { status: 200 }));
    await expect(boardApi.list()).rejects.toBeInstanceOf(BoardApiProtocolError);
    await expect(boardApi.list()).resolves.toEqual({
      locale: 'en',
      items: [{ ...board, title: { value: null, translationUnavailable: true }, description: { value: null, translationUnavailable: true } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
it('creates comments and toggles article reactions with credentialed requests', async () => {
  const comment = { id: 'comment-1', articleId: 'article-1', parentCommentId: null, authorNameKr: '홍길동', body: '좋은 글입니다.', status: 'PUBLISHED', canEdit: true, canDelete: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  const fetchMock = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(comment), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'LIKE', likeCount: 2 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ type: null, likeCount: 1 }), { status: 200 }));
  await expect(boardApi.createComment('article/1', { body: '좋은 글입니다.' })).resolves.toEqual(comment);
  await expect(boardApi.putReaction('article/1', { type: 'LIKE' })).resolves.toEqual({ type: 'LIKE', likeCount: 2 });
  await expect(boardApi.deleteReaction('article/1')).resolves.toEqual({ type: null, likeCount: 1 });
  expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/articles/article%2F1/comments', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/articles/article%2F1/reaction', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ type: 'LIKE' }) }));
});
