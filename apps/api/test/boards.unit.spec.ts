import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ArticlesService } from '../src/features/boards/articles.service';
import { BoardsService } from '../src/features/boards/boards.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const boardId = '33333333-3333-4333-8333-333333333333';
const articleId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-07-27T12:00:00.000Z');
const correlationId = 'boards-unit-correlation';
const board = (overrides = {}) => ({ id: boardId, code: 'notice', titleKr: '공지', titleEn: 'Notice', descriptionKr: '설명', descriptionEn: 'Description', readPermission: 'PUBLIC' as const, writePermission: 'AUTHENTICATED' as const, commentPermission: 'AUTHENTICATED' as const, commentsAllowed: true, secretArticlesAllowed: true, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: true, createdAt: now, updatedAt: now, ...overrides });
const article = (overrides = {}) => ({ id: articleId, boardId, authorUserId: actorId, titleKr: '제목', titleEn: 'Title', bodyKr: '본문', bodyEn: 'Body', status: 'DRAFT' as const, scope: 'ALL' as const, isPinned: false, pinnedOrder: null, publishedAt: null, deletedAt: null, purgeAfter: null, createdAt: now, updatedAt: now, ...overrides });
const createBoard = () => ({ code: ' notice ', titleKr: ' 공지 ', titleEn: ' Notice ', descriptionKr: ' 설명 ', descriptionEn: ' Description ', readPermission: 'PUBLIC' as const, writePermission: 'AUTHENTICATED' as const, commentPermission: 'AUTHENTICATED' as const, commentsAllowed: true, secretArticlesAllowed: true, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: true });
const createArticle = () => ({ titleKr: ' 제목 ', titleEn: ' Title ', bodyKr: ' 본문 ', bodyEn: ' Body ', scope: 'ALL' as const, isPinned: false, pinnedOrder: null });

function boardSetup(grants: readonly string[] = ['BOARD_MANAGE', 'COMMITTEE_MEMBER']) {
  const repository = { listVisible: vi.fn(), listVisibleHomeWithLatest: vi.fn(), findVisibleByCode: vi.fn(), create: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  const permissions = { hasPermission: vi.fn().mockImplementation(async (_id: string, name: string) => grants.includes(name)) };
  return { repository, permissions, service: new BoardsService(repository as never, permissions as never, { now: () => now } as never) };
}
function articleSetup(grants: readonly string[] = [], graceDays = 30) {
  const repository = {
    findBoardByCode: vi.fn().mockResolvedValue(board()),
    list: vi.fn(),
    findArticleWithBoardById: vi.fn(),
    create: vi.fn(async (_code: string, _actor: string, _correlationId: string, callback: any) => ({ article: article(await callback(board())), board: board() })),
    patch: vi.fn(),
    publish: vi.fn(),
    softDelete: vi.fn(),
  };
  const permissions = { hasPermission: vi.fn().mockImplementation(async (_id: string, name: string) => grants.includes(name)) };
  const config = { get: vi.fn().mockReturnValue(graceDays), getOrThrow: vi.fn().mockReturnValue(graceDays) };
  return { repository, permissions, config, service: new ArticlesService(repository as never, permissions as never, { now: () => now } as never, config as never) };
}

describe('BoardsService', () => {
  it('uses the strict home/latest query and projects unavailable translations', async () => {
    const { repository, service } = boardSetup();
    repository.listVisibleHomeWithLatest.mockResolvedValue([{ board: board({ titleEn: '', descriptionEn: '' }), latest: article({ status: 'PUBLISHED', publishedAt: now }) }]);
    await expect(service.list(undefined, { locale: 'en', home: true, latestLimit: 1 })).resolves.toMatchObject({ locale: 'en', items: [{ title: { value: null, translationUnavailable: true }, description: { value: null, translationUnavailable: true }, latestArticles: [{ title: { value: 'Title', translationUnavailable: false } }] }] });
    expect(repository.listVisibleHomeWithLatest).toHaveBeenCalledWith(now);
    for (const query of [{ home: false }, { home: true, latestLimit: 2 }, { latestLimit: 1 }, { home: true, extra: true }]) await expect(service.list(undefined, query)).rejects.toMatchObject({ response: { message: 'invalid_board_query' } });
  });

  it('hides inaccessible boards and applies every read permission without disclosing existence', async () => {
    for (const [permission, actor, grants, allowed, expectedPermission] of [
      ['PUBLIC', undefined, [], true, undefined],
      ['AUTHENTICATED', undefined, [], false, undefined],
      ['AUTHENTICATED', actorId, [], true, undefined],
      ['COMMITTEE', actorId, ['COMMITTEE_MEMBER'], true, 'COMMITTEE_MEMBER'],
      ['COMMITTEE', actorId, ['BOARD_MANAGE'], false, 'COMMITTEE_MEMBER'],
      ['ADMIN', actorId, ['BOARD_MANAGE'], true, 'BOARD_MANAGE'],
      ['ADMIN', actorId, ['COMMITTEE_MEMBER'], false, 'BOARD_MANAGE'],
    ] as const) {
      const { repository, permissions, service } = boardSetup(grants); repository.findVisibleByCode.mockResolvedValue(board({ readPermission: permission }));
      if (allowed) await expect(service.get(actor, ' notice ', 'ko')).resolves.toMatchObject({ board: { code: 'notice' } });
      else await expect(service.get(actor, ' notice ', 'ko')).rejects.toMatchObject({ response: { message: 'board_not_found' } });
      expect(repository.findVisibleByCode).toHaveBeenCalledWith('notice');
      if (expectedPermission) expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, expectedPermission, 'GLOBAL');
    }
    const { repository, service } = boardSetup(); repository.findVisibleByCode.mockResolvedValue(null);
    await expect(service.get(actorId, 'notice', 'ko')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires BOARD_MANAGE before board writes, normalizes writes, and maps conflicts', async () => {
    const denied = boardSetup([]);
    await expect(denied.service.create(actorId, createBoard(), correlationId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied.repository.create).not.toHaveBeenCalled();
    const { repository, permissions, service } = boardSetup(); repository.create.mockResolvedValue(board()); repository.patch.mockResolvedValue(board({ titleKr: '수정' }));
    await service.create(actorId, createBoard(), correlationId);
    expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, 'BOARD_MANAGE', 'GLOBAL');
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: actorId, correlationId, now, values: expect.objectContaining({ code: 'notice', titleKr: '공지' }) }));
    await service.patch(actorId, boardId, { titleKr: ' 수정 ' }, correlationId);
    expect(repository.patch).toHaveBeenCalledWith(boardId, expect.objectContaining({ correlationId, values: { titleKr: '수정' }, changedFieldNames: 'title' }));
    repository.create.mockRejectedValueOnce({ cause: { code: '23505' } });
    await expect(service.create(actorId, createBoard(), correlationId)).rejects.toBeInstanceOf(ConflictException);
    repository.create.mockRejectedValueOnce({ cause: { code: '40001' } });
    await expect(service.create(actorId, createBoard(), correlationId)).rejects.toMatchObject({ status: 503, cause: expect.objectContaining({ cause: { code: '40001' } }) });
  });

  it('rejects empty, unknown, and invalid board input and maps deletion outcomes', async () => {
    const { repository, service } = boardSetup();
    for (const input of [{}, { ...createBoard(), unexpected: true }, { ...createBoard(), code: '1bad' }, { ...createBoard(), displayOrder: -1 }]) await expect(service.create(actorId, input as never, correlationId)).rejects.toMatchObject({ response: { message: /invalid_board/ } });
    await expect(service.patch(actorId, boardId, {}, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_board' } });
    repository.delete.mockResolvedValueOnce('has_articles');
    await expect(service.delete(actorId, boardId, correlationId)).rejects.toMatchObject({ response: { message: 'board_has_articles' } });
    repository.delete.mockResolvedValueOnce('missing');
    await expect(service.delete(actorId, boardId, correlationId)).rejects.toMatchObject({ response: { message: 'board_not_found' } });
    expect(repository.delete).toHaveBeenLastCalledWith(boardId, actorId, correlationId);
  });
});

describe('ArticlesService', () => {
  it('uses default/max pagination, validates complete cursors, and passes scope visibility to the repository', async () => {
    const { repository, service } = articleSetup(); repository.list.mockResolvedValue([]);
    await service.list(undefined, 'notice', {});
    expect(repository.list).toHaveBeenLastCalledWith(boardId, ['ALL'], undefined, null, 21);
    await service.list(actorId, 'notice', { limit: '50' });
    expect(repository.list).toHaveBeenLastCalledWith(boardId, ['ALL', 'KAIST'], actorId, null, 51);
    const manager = articleSetup(['BOARD_MANAGE']); manager.repository.list.mockResolvedValue([]);
    await manager.service.list(actorId, 'notice', { limit: 1 });
    expect(manager.repository.list).toHaveBeenLastCalledWith(boardId, ['ALL', 'KAIST', 'STAFF', 'AUTHOR_AND_STAFF'], actorId, null, 2);

    const pinned = article({ status: 'PUBLISHED', isPinned: true, pinnedOrder: 3, publishedAt: now, objectKey: 'private-key' });
    repository.list.mockResolvedValueOnce([pinned, article({ id: otherId, status: 'PUBLISHED', publishedAt: now })]);
    const page = await service.list(undefined, 'notice', { limit: 1 });
    expect(page.items[0]).not.toHaveProperty('authorUserId');
    expect(page.items[0]).not.toHaveProperty('objectKey');
    repository.findArticleWithBoardById.mockResolvedValue({
      article: article({ status: 'PUBLISHED', publishedAt: now, objectKey: 'private-key' }),
      board: board(),
    });
    const detail = await service.get(undefined, articleId, 'en');
    expect(detail).not.toHaveProperty('authorUserId');
    expect(detail).not.toHaveProperty('objectKey');
    await service.list(undefined, 'notice', { cursor: page.nextCursor! });
    expect(repository.list).toHaveBeenLastCalledWith(boardId, ['ALL'], undefined, { isPinned: true, pinnedOrder: 3, publishedAt: now, id: articleId }, 21);

    for (const query of [
      { limit: 51 },
      { limit: 0 },
      { cursor: 'not-a-cursor' },
      { cursor: Buffer.from(JSON.stringify({ n: true, o: null, p: now.toISOString(), i: articleId })).toString('base64url') },
    ]) await expect(service.list(undefined, 'notice', query)).rejects.toMatchObject({ response: { message: /invalid_article_(limit|cursor)/ } });
  });

  it('enforces every board read tier, hidden boards, secret-board policy, and manager-only pinned writes', async () => {
    for (const [permission, actor, grants, allowed] of [
      ['PUBLIC', undefined, [], true],
      ['AUTHENTICATED', undefined, [], false],
      ['AUTHENTICATED', actorId, [], true],
      ['COMMITTEE', actorId, ['COMMITTEE_MEMBER'], true],
      ['COMMITTEE', actorId, ['BOARD_MANAGE'], false],
      ['ADMIN', actorId, ['BOARD_MANAGE'], true],
      ['ADMIN', actorId, ['COMMITTEE_MEMBER'], false],
    ] as const) {
      const setup = articleSetup(grants);
      setup.repository.findBoardByCode.mockResolvedValue(board({ readPermission: permission }));
      setup.repository.list.mockResolvedValue([]);
      if (allowed) await expect(setup.service.list(actor, ' notice ', {})).resolves.toMatchObject({ items: [] });
      else await expect(setup.service.list(actor, ' notice ', {})).rejects.toMatchObject({ response: { message: 'board_not_found' } });
      expect(setup.repository.findBoardByCode).toHaveBeenCalledWith('notice');
    }
    const hidden = articleSetup(); hidden.repository.findBoardByCode.mockResolvedValue(board({ isHidden: true }));
    await expect(hidden.service.list(actorId, 'notice', {})).rejects.toMatchObject({ response: { message: 'board_not_found' } });
    const { service } = articleSetup();
    for (const input of [{}, { ...createArticle(), unexpected: true }, { ...createArticle(), pinnedOrder: 0 }]) {
      await expect(service.create(actorId, 'notice', input as never, correlationId)).rejects.toMatchObject({ response: { message: /invalid_article/ } });
    }
    await expect(service.patch(actorId, articleId, {}, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_article' } });
    await expect(service.create(actorId, 'notice', { ...createArticle(), isPinned: true, pinnedOrder: 0 }, correlationId)).rejects.toBeInstanceOf(ForbiddenException);
    const secret = articleSetup();
    secret.repository.create.mockImplementation(async (_code: string, _actor: string, _correlationId: string, callback: any) => ({ article: article(await callback(board({ secretArticlesAllowed: false }))), board: board({ secretArticlesAllowed: false }) }));
    await expect(secret.service.create(actorId, 'notice', { ...createArticle(), scope: 'STAFF' }, correlationId)).rejects.toMatchObject({ response: { message: 'secret_articles_not_allowed' } });
    const transient = articleSetup();
    transient.repository.create.mockRejectedValue({ cause: { code: '40P01' } });
    await expect(transient.service.create(actorId, 'notice', createArticle(), correlationId))
      .rejects.toMatchObject({ status: 503, cause: expect.objectContaining({ cause: { code: '40P01' } }) });
  });
  it('applies every article write tier with exact permission keys before creation', async () => {
    for (const [permission, grants, allowed, expectedKey] of [
      ['PUBLIC', [], true, null],
      ['AUTHENTICATED', [], true, null],
      ['COMMITTEE', ['COMMITTEE_MEMBER'], true, 'COMMITTEE_MEMBER'],
      ['COMMITTEE', ['BOARD_MANAGE'], false, 'COMMITTEE_MEMBER'],
      ['ADMIN', ['BOARD_MANAGE'], true, 'BOARD_MANAGE'],
      ['ADMIN', ['COMMITTEE_MEMBER'], false, 'BOARD_MANAGE'],
    ] as const) {
      const { repository, permissions, service } = articleSetup(grants);
      let inserted = false;
      repository.create.mockImplementation(async (_code: string, _actor: string, _correlation: string, callback: any) => {
        const lockedBoard = board({ writePermission: permission });
        const values = await callback(lockedBoard);
        inserted = true;
        return { article: article(values), board: lockedBoard };
      });
      if (allowed) await expect(service.create(actorId, 'notice', createArticle(), `write-${permission}`)).resolves.toMatchObject({ status: 'DRAFT' });
      else await expect(service.create(actorId, 'notice', createArticle(), `write-${permission}`)).rejects.toBeInstanceOf(ForbiddenException);
      expect(inserted).toBe(allowed);
      if (expectedKey) expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, expectedKey, 'GLOBAL');
    }
  });

  it('revalidates locked policy and current authority inside mutation callbacks', async () => {
    const locked = articleSetup([]);
    locked.repository.create.mockImplementation(async (_code: string, _actor: string, _correlationId: string, callback: any) => callback(board({ isHidden: true })));
    await expect(locked.service.create(actorId, 'notice', createArticle(), correlationId)).rejects.toMatchObject({ response: { message: 'board_not_found' } });

    locked.repository.patch.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) =>
      callback(article(), board({ writePermission: 'ADMIN' })));
    await expect(locked.service.patch(actorId, articleId, { titleKr: '수정' }, correlationId)).rejects.toBeInstanceOf(ForbiddenException);
    locked.repository.patch.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) =>
      callback(article(), board({ isHidden: true })));
    await expect(locked.service.patch(actorId, articleId, { titleKr: '수정' }, correlationId))
      .rejects.toMatchObject({ response: { message: 'article_not_found' } });
    const foreign = articleSetup([]);
    foreign.repository.patch.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) =>
      callback(article({ authorUserId: otherId }), board({ writePermission: 'ADMIN' })));
    await expect(foreign.service.patch(actorId, articleId, { titleKr: '수정' }, correlationId))
      .rejects.toMatchObject({ response: { message: 'article_not_found' } });

    const { repository, service } = articleSetup(['BOARD_MANAGE']);
    repository.publish.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) => {
      const values = await callback(article({ status: 'DRAFT' }), board({ writePermission: 'ADMIN' }));
      return { article: article({ ...values, status: 'PUBLISHED', publishedAt: now }), board: board({ writePermission: 'ADMIN' }) };
    });
    await expect(service.publish(actorId, articleId, correlationId)).resolves.toMatchObject({ status: 'PUBLISHED', publishedAt: now.toISOString() });
    expect(repository.publish).toHaveBeenCalledWith(articleId, actorId, correlationId, expect.any(Function));
    const secretPublish = articleSetup(['BOARD_MANAGE']);
    secretPublish.repository.publish.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) =>
      callback(article({ status: 'DRAFT', scope: 'STAFF' }), board({ writePermission: 'ADMIN', secretArticlesAllowed: false })));
    await expect(secretPublish.service.publish(actorId, articleId, correlationId))
      .rejects.toMatchObject({ response: { message: 'secret_articles_not_allowed' } });

    repository.softDelete.mockImplementation(async (_id: string, _actor: string, _correlationId: string, callback: any) => {
      const values = await callback(article({ status: 'PUBLISHED' }), board({ writePermission: 'ADMIN' }));
      expect(values.purgeAfter).toEqual(new Date('2026-08-26T12:00:00.000Z'));
      return { article: article(values), board: board({ writePermission: 'ADMIN' }) };
    });
    await expect(service.softDelete(actorId, articleId, correlationId)).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledWith(articleId, actorId, correlationId, expect.any(Function));
  });

  it('does not disclose deleted articles and reserves publication for publish', async () => {
    const { repository, service } = articleSetup(['BOARD_MANAGE']);
    repository.findArticleWithBoardById.mockResolvedValue({ article: article({ status: 'DELETED' }), board: board() });
    await expect(service.get(actorId, articleId, 'ko')).rejects.toMatchObject({ response: { message: 'article_not_found' } });
    await expect(service.patch(actorId, articleId, { status: 'PUBLISHED' } as never, correlationId)).rejects.toMatchObject({ response: { message: 'invalid_article_transition' } });
    expect(repository.patch).not.toHaveBeenCalled();
  });
});
