import { ConflictException, INestApplication, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { ArticlesService } from '../src/features/boards/articles.service';
import { AdminBoardsController, BoardWritesController, PublicArticlesController, PublicBoardsController } from '../src/features/boards/boards.controller';
import { BoardsService } from '../src/features/boards/boards.service';
import { InteractionsService } from '../src/features/boards/interactions.service';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard, OptionalAuthGuard } from '../src/shared/guards';
import { UsersService } from '../src/features/users/users.service';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

const actorId = '10000000-0000-4000-8000-000000000001';
const boardId = '10000000-0000-4000-8000-000000000002';
const articleId = '10000000-0000-4000-8000-000000000003';
const commentId = '10000000-0000-4000-8000-000000000004';
const assetId = '10000000-0000-4000-8000-000000000005';
const boardInput = { code: 'notice', titleKr: '공지', titleEn: 'Notice', descriptionKr: '설명', descriptionEn: 'Description', readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: true, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: true };
const articleInput = { titleKr: '제목', titleEn: 'Title', bodyKr: '본문', bodyEn: 'Body', scope: 'ALL', isPinned: false, pinnedOrder: null };
const article = { id: articleId, boardCode: 'notice', title: { value: 'Title', translationUnavailable: false }, body: { value: 'Body', translationUnavailable: false }, status: 'PUBLISHED', scope: 'ALL', isPinned: false, pinnedOrder: null, publishedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null };

describe('Boards HTTP boundary', () => {
  let app: INestApplication;
  let boards: Record<string, ReturnType<typeof vi.fn>>;
  let articles: Record<string, ReturnType<typeof vi.fn>>;
  let interactions: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    boards = { list: vi.fn().mockResolvedValue({ locale: 'ko', items: [] }), get: vi.fn().mockResolvedValue({ locale: 'ko', board: { id: boardId, code: 'notice' } }), adminList: vi.fn().mockResolvedValue({ items: [{ id: boardId, displayOrder: 0 }] }), create: vi.fn().mockResolvedValue({ id: boardId }), patch: vi.fn().mockResolvedValue({ id: boardId }), delete: vi.fn() };
    articles = { list: vi.fn().mockResolvedValue({ locale: 'ko', items: [], nextCursor: null }), get: vi.fn().mockResolvedValue(article), create: vi.fn().mockResolvedValue(article), patch: vi.fn().mockResolvedValue(article), publish: vi.fn().mockResolvedValue(article), softDelete: vi.fn() };
    interactions = { detailExtras: vi.fn().mockResolvedValue({ comments: [{ id: commentId, body: 'visible' }], assets: [{ id: assetId, contentType: 'image/png' }], myReaction: 'LIKE' }), createComment: vi.fn().mockResolvedValue({ id: commentId }), patchComment: vi.fn().mockResolvedValue({ id: commentId }), deleteComment: vi.fn(), putReaction: vi.fn().mockResolvedValue({ type: 'LIKE' }), deleteReaction: vi.fn().mockResolvedValue({ type: null }), initiateAsset: vi.fn().mockRejectedValue(new ServiceUnavailableException('feature_disabled')), completeAsset: vi.fn().mockRejectedValue(new ServiceUnavailableException('feature_disabled')), deleteAsset: vi.fn().mockRejectedValue(new ServiceUnavailableException('feature_disabled')) };
    const module = await Test.createTestingModule({
      controllers: [PublicBoardsController, PublicArticlesController, AdminBoardsController, BoardWritesController],
      providers: [AuthGuard, OptionalAuthGuard, { provide: BoardsService, useValue: boards }, { provide: ArticlesService, useValue: articles }, { provide: InteractionsService, useValue: interactions }, { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockImplementation((token: string) => { if (token === 'malformed') throw new UnauthorizedException('access_cookie_invalid'); return { mode: 'persisted', sub: actorId, sid: 'sid' }; }) } }, { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actorId }) } }],
    }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); const requestIdMiddleware = new RequestIdMiddleware(); app.use(requestIdMiddleware.use.bind(requestIdMiddleware)); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => { await app.close(); });

  const authenticated = (method: 'post' | 'patch' | 'put' | 'delete', path: string) => request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=access-token').set('x-request-id', 'boards-http-mutation');

  it('covers enabled board and article reads, forwards optional identity, and assembles safe article detail', async () => {
    await request(app.getHttpServer()).get('/api/boards?locale=en').expect(200);
    expect(boards.list).toHaveBeenCalledWith(undefined, { locale: 'en' });
    await request(app.getHttpServer()).get('/api/boards/notice?locale=en').set('Cookie', 'soc_at=access-token').expect(200);
    expect(boards.get).toHaveBeenCalledWith(actorId, 'notice', 'en');
    await request(app.getHttpServer()).get('/api/boards/notice/articles?limit=10').set('Cookie', 'soc_at=access-token').expect(200);
    expect(articles.list).toHaveBeenCalledWith(actorId, 'notice', { limit: 10 });
    const response = await request(app.getHttpServer()).get(`/api/articles/${articleId}?locale=en`).set('Cookie', 'soc_at=access-token').expect(200);
    expect(response.body).toEqual({ locale: 'en', article, comments: [{ id: commentId, body: 'visible' }], assets: [{ id: assetId, contentType: 'image/png' }], myReaction: 'LIKE' });
    expect(articles.get).toHaveBeenCalledWith(actorId, articleId, 'en');
    expect(interactions.detailExtras).toHaveBeenCalledWith(actorId, articleId);
    expect(response.text).not.toMatch(/uploadUrl|uploadHeaders|objectKey|secret/i);
    const defaultLocale = await request(app.getHttpServer()).get(`/api/articles/${articleId}`).expect(200);
    expect(defaultLocale.body.locale).toBe('ko');
    expect(articles.get).toHaveBeenLastCalledWith(undefined, articleId, 'ko');
  });

  it('treats absent optional cookies as anonymous and empty or malformed cookies as unauthenticated', async () => {
    await request(app.getHttpServer()).get('/api/boards').expect(200);
    await request(app.getHttpServer()).get('/api/boards').set('Cookie', 'soc_at=').expect(401);
    await request(app.getHttpServer()).get('/api/boards').set('Cookie', 'soc_at=malformed').expect(401);
    expect(boards.list).toHaveBeenCalledTimes(1);
  });
  it('requires authentication for the ordered admin board catalog', async () => {
    await request(app.getHttpServer()).get('/api/admin/boards').expect(401);
    await request(app.getHttpServer()).get('/api/admin/boards').set('Cookie', 'soc_at=access-token').expect(200);
    expect(boards.adminList).toHaveBeenCalledTimes(1);
    expect(boards.adminList).toHaveBeenCalledWith(actorId);
  });

  it('requires authentication for every write without disclosing target identifiers', async () => {
    const cases = [
      ['post', '/api/admin/boards', boardInput], ['patch', `/api/admin/boards/${boardId}`, { titleEn: 'Edited', expectedUpdatedAt: article.updatedAt }], ['delete', `/api/admin/boards/${boardId}`, { expectedUpdatedAt: article.updatedAt }],
      ['post', '/api/boards/notice/articles', articleInput], ['patch', `/api/articles/${articleId}`, { titleEn: 'Edited' }], ['post', `/api/articles/${articleId}/publish`, undefined], ['delete', `/api/articles/${articleId}`, undefined],
      ['post', `/api/articles/${articleId}/comments`, { body: 'Comment' }], ['patch', `/api/comments/${commentId}`, { body: 'Edited' }], ['delete', `/api/comments/${commentId}`, undefined],
      ['put', `/api/articles/${articleId}/reaction`, { type: 'LIKE' }], ['delete', `/api/articles/${articleId}/reaction`, undefined],
      ['post', `/api/articles/${articleId}/assets/initiate`, { displayOrder: 0, type: 'IMAGE', contentType: 'image/png', byteSize: 1 }], ['post', `/api/assets/${assetId}/complete`, {}], ['delete', `/api/assets/${assetId}`, undefined],
    ] as const;
    for (const [method, path, body] of cases) {
      const client = request(app.getHttpServer())[method](path);
      const response = await (body === undefined ? client : client.send(body)).expect(401);
      expect(response.text).not.toContain(articleId); expect(response.text).not.toContain(commentId); expect(response.text).not.toContain(assetId);
    }
    expect([...Object.values(boards), ...Object.values(articles), ...Object.values(interactions)].every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it('forwards every enabled mutation with the authenticated actor and exact request values', async () => {
    await authenticated('post', '/api/admin/boards').send(boardInput).expect(201);
    await authenticated('patch', `/api/admin/boards/${boardId}`).send({ titleEn: 'Edited', expectedUpdatedAt: article.updatedAt }).expect(200);
    await authenticated('delete', `/api/admin/boards/${boardId}`).send({ expectedUpdatedAt: article.updatedAt }).expect(204);
    await authenticated('post', '/api/boards/notice/articles').send(articleInput).expect(201);
    await authenticated('patch', `/api/articles/${articleId}`).send({ titleEn: 'Edited' }).expect(200);
    await authenticated('post', `/api/articles/${articleId}/publish`).expect(200);
    await authenticated('delete', `/api/articles/${articleId}`).expect(204);
    await authenticated('post', `/api/articles/${articleId}/comments`).send({ body: 'Comment' }).expect(201);
    await authenticated('patch', `/api/comments/${commentId}`).send({ body: 'Edited' }).expect(200);
    await authenticated('delete', `/api/comments/${commentId}`).expect(204);
    await authenticated('put', `/api/articles/${articleId}/reaction`).send({ type: 'LIKE' }).expect(200);
    await authenticated('delete', `/api/articles/${articleId}/reaction`).expect(200);
    expect(boards.create).toHaveBeenCalledWith(actorId, boardInput, 'boards-http-mutation'); expect(boards.patch).toHaveBeenCalledWith(actorId, boardId, { titleEn: 'Edited', expectedUpdatedAt: article.updatedAt }, 'boards-http-mutation'); expect(boards.delete).toHaveBeenCalledWith(actorId, boardId, article.updatedAt, 'boards-http-mutation');
    expect(articles.create).toHaveBeenCalledWith(actorId, 'notice', articleInput, 'boards-http-mutation'); expect(articles.patch).toHaveBeenCalledWith(actorId, articleId, { titleEn: 'Edited' }, 'boards-http-mutation'); expect(articles.publish).toHaveBeenCalledWith(actorId, articleId, 'boards-http-mutation'); expect(articles.softDelete).toHaveBeenCalledWith(actorId, articleId, 'boards-http-mutation');
    expect(interactions.createComment).toHaveBeenCalledWith(actorId, articleId, { body: 'Comment' }, 'boards-http-mutation'); expect(interactions.patchComment).toHaveBeenCalledWith(actorId, commentId, { body: 'Edited' }, 'boards-http-mutation'); expect(interactions.deleteComment).toHaveBeenCalledWith(actorId, commentId, 'boards-http-mutation'); expect(interactions.putReaction).toHaveBeenCalledWith(actorId, articleId, { type: 'LIKE' }, 'boards-http-mutation'); expect(interactions.deleteReaction).toHaveBeenCalledWith(actorId, articleId, 'boards-http-mutation');
  });

  it('rejects malformed queries, paths, and mutation bodies before reaching services', async () => {
    for (const path of [
      '/api/boards?unexpected=true', '/api/boards?home=false&latestLimit=1', '/api/boards?locale=en&locale=ko',
      '/api/boards/notice?locale=en&locale=ko', '/api/boards/notice/articles?limit=0', '/api/boards/notice/articles?limit=1&limit=2',
      '/api/articles/not-a-uuid', `/api/articles/${articleId}?locale=en&locale=ko`,
    ]) await request(app.getHttpServer()).get(path).expect(422);
    for (const [method, path, body] of [
      ['post', '/api/admin/boards', {}], ['post', '/api/admin/boards', { ...boardInput, extra: true }], ['post', '/api/admin/boards', { ...boardInput, commentsAllowed: 'true' }], ['patch', `/api/admin/boards/${boardId}`, {}], ['patch', `/api/admin/boards/${boardId}`, { titleEn: 'Edited' }], ['patch', `/api/admin/boards/not-a-uuid`, { titleEn: 'Edited', expectedUpdatedAt: article.updatedAt }], ['delete', `/api/admin/boards/${boardId}`], ['delete', `/api/admin/boards/${boardId}`, { expectedUpdatedAt: 'not-a-date' }],
      ['post', '/api/boards/1notice/articles', articleInput], ['post', '/api/boards/notice/articles', { ...articleInput, scope: 'INVALID' }], ['post', '/api/boards/notice/articles', { ...articleInput, isPinned: true, pinnedOrder: null }], ['patch', `/api/articles/${articleId}`, {}], ['patch', `/api/articles/${articleId}`, { isPinned: false, pinnedOrder: 1 }], ['patch', '/api/articles/not-a-uuid', { titleEn: 'Edited' }],
      ['post', `/api/articles/${articleId}/comments`, {}], ['post', `/api/articles/${articleId}/comments`, { body: 1 }], ['patch', `/api/comments/${commentId}`, {}], ['patch', '/api/comments/not-a-uuid', { body: 'Edited' }], ['put', `/api/articles/${articleId}/reaction`, {}], ['put', `/api/articles/${articleId}/reaction`, { type: 'HEART' }],
      ['post', `/api/articles/${articleId}/assets/initiate`, { displayOrder: 0, type: 'IMAGE', contentType: 'invalid', byteSize: 1 }], ['post', `/api/articles/${articleId}/assets/initiate`, { displayOrder: 0, type: 'IMAGE', contentType: 'image/png', byteSize: 0 }], ['post', `/api/articles/${articleId}/assets/initiate`, { displayOrder: 0, type: 'IMAGE', contentType: 'image/png', byteSize: 1, checksumSha256: 'bad' }], ['post', `/api/assets/${assetId}/complete`, { checksumSha256: 'bad' }],
    ] as const) await authenticated(method, path).send(body).expect(422);
    expect([...Object.values(boards), ...Object.values(articles), ...Object.values(interactions)].every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });
  it('rejects missing or malformed board versions and returns stale conflicts', async () => {
    const missingPatch = await authenticated('patch', `/api/admin/boards/${boardId}`).send({ titleEn: 'Edited' }).expect(422);
    const malformedDelete = await authenticated('delete', `/api/admin/boards/${boardId}`).send({ expectedUpdatedAt: 'not-a-date' }).expect(422);
    expect(missingPatch.body.code).toBe('invalid_board_version');
    expect(malformedDelete.body.code).toBe('invalid_board_version');
    boards.patch.mockRejectedValueOnce(new ConflictException('board_stale'));
    boards.delete.mockRejectedValueOnce(new ConflictException('board_stale'));
    await authenticated('patch', `/api/admin/boards/${boardId}`).send({ titleEn: 'Edited', expectedUpdatedAt: article.updatedAt }).expect(409);
    await authenticated('delete', `/api/admin/boards/${boardId}`).send({ expectedUpdatedAt: article.updatedAt }).expect(409);
  });

  it('returns declared no-disclosure, feature-disabled, missing-reaction, and asset-provider errors', async () => {
    articles.get.mockRejectedValueOnce(new NotFoundException('article_not_found'));
    const hidden = await request(app.getHttpServer()).get(`/api/articles/${articleId}`).expect(404);
    expect(hidden.text).not.toContain(articleId);
    articles.patch.mockRejectedValueOnce(new NotFoundException('article_not_found'));
    const deniedMutation = await authenticated('patch', `/api/articles/${articleId}`).send({ titleEn: 'Denied' }).expect(404);
    expect(deniedMutation.text).not.toContain(articleId);
    interactions.createComment.mockRejectedValueOnce(new ConflictException('comments_disabled'));
    await authenticated('post', `/api/articles/${articleId}/comments`).send({ body: 'Comment' }).expect(409);
    interactions.putReaction.mockRejectedValueOnce(new ConflictException('reactions_disabled'));
    await authenticated('put', `/api/articles/${articleId}/reaction`).send({ type: 'LIKE' }).expect(409);
    interactions.deleteReaction.mockRejectedValueOnce(new NotFoundException('reaction_not_found'));
    await authenticated('delete', `/api/articles/${articleId}/reaction`).expect(404);
    const initiated = await authenticated('post', `/api/articles/${articleId}/assets/initiate`).send({ displayOrder: 0, type: 'IMAGE', contentType: 'image/png', byteSize: 1 }).expect(503);
    const completed = await authenticated('post', `/api/assets/${assetId}/complete`).send({}).expect(503);
    const deleted = await authenticated('delete', `/api/assets/${assetId}`).expect(503);
    for (const response of [initiated, completed, deleted]) expect(response.body).toEqual({ code: 'feature_disabled', message: 'Internal server error', requestId: expect.any(String) });
    expect(interactions.initiateAsset).toHaveBeenCalledWith(actorId, articleId, expect.any(Object), initiated.body.requestId);
    expect(interactions.completeAsset).toHaveBeenCalledWith(actorId, assetId, {}, completed.body.requestId);
    expect(interactions.deleteAsset).toHaveBeenCalledWith(actorId, assetId, deleted.body.requestId);
  });
});
