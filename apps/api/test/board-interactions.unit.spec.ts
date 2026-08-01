import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { InteractionsService } from '../src/features/boards/interactions.service';
import { PurgeService } from '../src/features/boards/purge.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const articleId = '33333333-3333-4333-8333-333333333333';
const otherArticleId = '44444444-4444-4444-8444-444444444444';
const commentId = '55555555-5555-4555-8555-555555555555';
const assetId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-07-27T12:00:00.000Z');

const article = (overrides = {}) => ({
  article: { id: articleId, status: 'PUBLISHED' as const, scope: 'ALL' as const, authorUserId: actorId },
  board: { commentsAllowed: true, reactionsAllowed: true, commentPermission: 'PUBLIC' as const, readPermission: 'PUBLIC' as const },
  ...overrides,
});
const comment = (overrides = {}) => ({
  id: commentId, articleId, parentCommentId: null, authorUserId: actorId, body: 'comment', status: 'PUBLISHED' as const, createdAt: now, updatedAt: now, ...overrides,
});

function interactionsSetup(options: { manager?: boolean; committee?: boolean; graceDays?: number; assetsEnabled?: boolean } = {}) {
  const repository: Record<string, ReturnType<typeof vi.fn>> = {
    findArticleWithBoard: vi.fn().mockResolvedValue(article()),
    createComment: vi.fn(),
    findComment: vi.fn(),
    patchComment: vi.fn(),
    softDeleteComment: vi.fn(),
    listArticleDetailComments: vi.fn().mockResolvedValue([]),
    listArticleDetailAssets: vi.fn().mockResolvedValue([]),
    findArticleDetailReaction: vi.fn().mockResolvedValue(null),
    putReaction: vi.fn(),
    deleteReaction: vi.fn(),
    countLikes: vi.fn().mockResolvedValue(1),
  };
  repository.readPublishedArticleComments = vi.fn(async (_articleId: string, validate: (state: ReturnType<typeof article>) => Promise<{ canReadSecretComments: boolean }>) => {
    const access = await validate(article());
    return { comments: await repository.listArticleDetailComments(), ...access };
  });
  repository.readArticleDetail = vi.fn(async (_articleId: string, _actorId: string | undefined, validate: (state: ReturnType<typeof article>) => Promise<{ canReadSecretComments: boolean }>) => {
    const access = await validate(article());
    return {
      comments: await repository.listArticleDetailComments(),
      assets: await repository.listArticleDetailAssets(),
      reaction: await repository.findArticleDetailReaction(),
      likeCount: 1,
      ...access,
    };
  });
  const permissionGrants = new Set([
    ...(options.manager ? ['BOARD_MANAGE'] : []),
    ...(options.committee ? ['COMMITTEE_MEMBER'] : []),
  ]);
  const permissions = { hasPermission: vi.fn().mockImplementation(async (_id, permission) => permissionGrants.has(permission)) };
  const configValue = (key: string, fallback?: number | boolean) => key === 'CONTENT_PURGE_GRACE_DAYS' ? (options.graceDays ?? 30) : (options.assetsEnabled ?? fallback);
  const config = { get: vi.fn().mockImplementation(configValue), getOrThrow: vi.fn().mockImplementation(configValue) };
  const users = { findById: vi.fn().mockResolvedValue({ nameKr: '홍길동' }) };
  return { repository, permissions, config, service: new InteractionsService(repository as never, permissions as never, { now: () => now } as never, config as never, users as never) };
}

function purgeSetup(options: { manager?: boolean; configuredBatch?: number } = {}) {
  const repository = {
    listExpiredAssetIds: vi.fn().mockResolvedValue([]), listExpiredCommentIds: vi.fn().mockResolvedValue([]), listExpiredArticleIds: vi.fn().mockResolvedValue([]),
    purgeAsset: vi.fn(), purgeComment: vi.fn(), purgeArticle: vi.fn(), placeLegalHold: vi.fn(), releaseLegalHold: vi.fn(),
  };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(Boolean(options.manager)) };
  const config = { get: vi.fn().mockReturnValue(options.configuredBatch ?? 50) };
  return { repository, permissions, service: new PurgeService(repository as never, permissions as never, { nowMs: () => now.getTime() } as never, config as never) };
}

describe('InteractionsService', () => {
  it('fails closed when comments are disabled and rejects parents from another article', async () => {
    const { repository, service } = interactionsSetup();
    repository.createComment.mockImplementationOnce(async (_input, _correlation, validate) => {
      await validate({ ...article({ board: { ...article().board, commentsAllowed: false } }), parent: null });
      return null;
    });
    await expect(service.createComment(actorId, articleId, { body: 'body' }, 'create-disabled')).rejects.toMatchObject({ response: { message: 'comments_disabled' } });

    repository.createComment.mockImplementationOnce(async (_input, _correlation, validate) => {
      await validate({ ...article(), parent: comment({ articleId: otherArticleId }) });
      return null;
    });
    await expect(service.createComment(actorId, articleId, { body: 'body', parentCommentId: commentId }, 'create-parent')).rejects.toMatchObject({ response: { message: 'invalid_parent_comment' } });
    expect(repository.createComment).toHaveBeenLastCalledWith(expect.objectContaining({ articleId, parentCommentId: commentId }), 'create-parent', expect.any(Function));
  });
  it('rejects unknown comment and reaction fields before repository writes', async () => {
    const { repository, service } = interactionsSetup();
    await expect(service.createComment(actorId, articleId, { body: 'body', extra: true } as never, 'strict-comment'))
      .rejects.toMatchObject({ response: { message: 'invalid_comment' } });
    await expect(service.putReaction(actorId, articleId, { type: 'LIKE', extra: true } as never, 'strict-reaction'))
      .rejects.toMatchObject({ response: { message: 'invalid_reaction' } });
    expect(repository.createComment).not.toHaveBeenCalled();
    expect(repository.putReaction).not.toHaveBeenCalled();
  });
  it('uses exact permission tiers for comment and reaction writes', async () => {
    for (const [permission, options, allowed, expectedKey] of [
      ['PUBLIC', {}, true, null],
      ['AUTHENTICATED', {}, true, null],
      ['COMMITTEE', { committee: true }, true, 'COMMITTEE_MEMBER'],
      ['COMMITTEE', { manager: true }, false, 'COMMITTEE_MEMBER'],
      ['ADMIN', { manager: true }, true, 'BOARD_MANAGE'],
      ['ADMIN', { committee: true }, false, 'BOARD_MANAGE'],
    ] as const) {
      const { repository, permissions, service } = interactionsSetup(options);
      let commentInserted = false;
      repository.createComment.mockImplementation(async (_input, _correlation, validate) => {
        await validate({ ...article({ board: { ...article().board, commentPermission: permission } }), parent: null });
        commentInserted = true;
        return comment();
      });
      if (allowed) await expect(service.createComment(actorId, articleId, { body: 'body' }, `comment-${permission}`)).resolves.toMatchObject({ id: commentId });
      else await expect(service.createComment(actorId, articleId, { body: 'body' }, `comment-${permission}`)).rejects.toBeInstanceOf(ForbiddenException);
      expect(commentInserted).toBe(allowed);
      if (expectedKey) expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, expectedKey, 'GLOBAL');

      let reactionInserted = false;
      repository.putReaction.mockImplementation(async (_articleId, _actorId, _type, _now, _correlation, validate) => {
        await validate(article({ board: { ...article().board, readPermission: permission } }));
        reactionInserted = true;
        return true;
      });
      if (allowed) await expect(service.putReaction(actorId, articleId, { type: 'LIKE' }, `reaction-${permission}`)).resolves.toEqual({ type: 'LIKE', likeCount: 1 });
      else await expect(service.putReaction(actorId, articleId, { type: 'LIKE' }, `reaction-${permission}`)).rejects.toMatchObject({ response: { message: 'article_not_found' } });
      expect(reactionInserted).toBe(allowed);
      if (expectedKey) expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, expectedKey, 'GLOBAL');
    }
  });

  it('masks secret and deleted bodies, while allowing only authors or BOARD_MANAGE to mutate', async () => {
    const { repository, service } = interactionsSetup();
    repository.listArticleDetailComments.mockResolvedValue([
      comment({ status: 'SECRET', body: 'secret' }), comment({ id: otherArticleId, status: 'DELETED', body: 'deleted' }),
    ]);
    await expect(service.listComments(otherId, articleId)).resolves.toMatchObject([{ body: null }, { body: null }]);
    repository.patchComment.mockImplementationOnce(async (_id, _actor, _values, _changed, _correlation, validate) => {
      await validate({ ...article(), comment: comment({ authorUserId: otherId }) });
      return null;
    });
    repository.softDeleteComment.mockImplementationOnce(async (_id, _actor, _now, _purgeAfter, _correlation, validate) => {
      await validate({ ...article(), comment: comment({ authorUserId: otherId }) });
      return false;
    });
    await expect(service.patchComment(actorId, commentId, { body: 'new' }, 'patch-denied')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteComment(actorId, commentId, 'delete-denied')).rejects.toBeInstanceOf(ForbiddenException);

    repository.patchComment.mockImplementationOnce(async (_id, _actor, _values, _changed, _correlation, validate) =>
      validate({ ...article({ board: { ...article().board, isHidden: true } }), comment: comment() }));
    repository.softDeleteComment.mockImplementationOnce(async (_id, _actor, _now, _purgeAfter, _correlation, validate) =>
      validate({ ...article({ board: { ...article().board, isHidden: true } }), comment: comment() }));
    await expect(service.patchComment(actorId, commentId, { body: 'hidden' }, 'patch-hidden')).rejects.toMatchObject({ response: { message: 'comment_not_found' } });
    await expect(service.deleteComment(actorId, commentId, 'delete-hidden')).rejects.toMatchObject({ response: { message: 'comment_not_found' } });

    const managed = interactionsSetup({ manager: true });
    managed.repository.patchComment.mockImplementation(async (_id, _actor, values, _changed, _correlation, validate) => {
      await validate({ ...article(), comment: comment({ authorUserId: otherId }) });
      return comment({ authorUserId: otherId, ...values });
    });
    await expect(managed.service.patchComment(actorId, commentId, { body: ' new ' }, 'patch-managed')).resolves.toMatchObject({ body: 'new' });
    expect(managed.repository.patchComment).toHaveBeenCalledWith(commentId, actorId, expect.objectContaining({ body: 'new' }), 'body', 'patch-managed', expect.any(Function));
  });

  it('uses configured soft-delete grace and applies article/read/reaction rules before repository writes', async () => {
    const { repository, service } = interactionsSetup({ graceDays: 7 });
    repository.softDeleteComment.mockImplementation(async (_id, _actor, _now, _purgeAfter, _correlation, validate) => {
      await validate({ ...article(), comment: comment() });
      return true;
    });
    await service.deleteComment(actorId, commentId, 'delete-comment');
    expect(repository.softDeleteComment).toHaveBeenCalledWith(commentId, actorId, now, new Date('2026-08-03T12:00:00.000Z'), 'delete-comment', expect.any(Function));

    repository.putReaction.mockImplementationOnce(async (_articleId, _actor, _type, _now, _correlation, validate) => {
      await validate(article({ board: { ...article().board, reactionsAllowed: false } }));
      return true;
    });
    await expect(service.putReaction(actorId, articleId, { type: 'LIKE' }, 'reaction-disabled')).rejects.toMatchObject({ response: { message: 'reactions_disabled' } });
    repository.putReaction.mockImplementationOnce(async (_articleId, _actor, _type, _now, _correlation, validate) => {
      await validate(article({ board: { ...article().board, readPermission: 'AUTHENTICATED' } }));
      return true;
    });
    await expect(service.putReaction(undefined as never, articleId, { type: 'LIKE' }, 'reaction-anonymous')).rejects.toMatchObject({ response: { message: 'article_not_found' } });
    repository.deleteReaction.mockResolvedValueOnce({ kind: 'reaction_not_found' });
    await expect(service.deleteReaction(actorId, articleId, 'reaction-delete')).rejects.toMatchObject({ response: { message: 'reaction_not_found' } });
    repository.deleteReaction.mockResolvedValueOnce({ kind: 'article_not_found' });
    await expect(service.deleteReaction(actorId, articleId, 'reaction-missing-article')).rejects.toMatchObject({ response: { message: 'article_not_found' } });
  });

  it.each([false])('keeps every asset operation unavailable with asset gate %s', async (assetsEnabled) => {
    const { service } = interactionsSetup({ assetsEnabled });
    await expect(service.initiateAsset(actorId, articleId, {} as never)).rejects.toMatchObject({ response: { message: 'feature_disabled', statusCode: 503 } });
    await expect(service.completeAsset(actorId, assetId, {} as never)).rejects.toMatchObject({ response: { message: 'feature_disabled', statusCode: 503 } });
    await expect(service.deleteAsset(actorId, assetId)).rejects.toMatchObject({ response: { message: 'feature_disabled', statusCode: 503 } });
  });

  it('projects detail extras through the same comment masking and asset/reaction projections', async () => {
    const { repository, service } = interactionsSetup();
    repository.listArticleDetailComments.mockResolvedValue([comment({ status: 'SECRET', body: 'secret' })]);
    repository.listArticleDetailAssets.mockResolvedValue([{
      id: assetId, articleId, displayOrder: 0, type: 'IMAGE', status: 'COMPLETED',
      provider: 'secret-provider', objectKey: 'secret-object-key', uploadUrl: 'https://secret.invalid',
      uploadHeaders: { Authorization: 'secret' }, contentType: 'image/png', byteSize: 2,
      checksumSha256: null, completedAt: now,
    }]);
    repository.findArticleDetailReaction.mockResolvedValue(null);
    const detail = await service.detailExtras(otherId, articleId);
    expect(detail).toEqual({
      comments: [expect.objectContaining({ body: null, authorNameKr: '홍길동', canEdit: false, canDelete: false })],
      assets: [expect.objectContaining({ id: assetId, completedAt: now.toISOString() })],
      myReaction: null,
      likeCount: 1,
    });
    expect(JSON.stringify(detail)).not.toMatch(/authorUserId|secret-provider|secret-object-key|uploadUrl|uploadHeaders|Authorization/);
  });
});

describe('PurgeService', () => {
  it('clamps batch bounds and uses one correlation ID for every purge command in a run', async () => {
    const { repository, service } = purgeSetup({ configuredBatch: 0 });
    repository.listExpiredAssetIds.mockResolvedValue([{ id: assetId }]); repository.listExpiredCommentIds.mockResolvedValue([{ id: commentId }]); repository.listExpiredArticleIds.mockResolvedValue([{ id: articleId }]);
    repository.purgeAsset.mockResolvedValue(true); repository.purgeComment.mockResolvedValue(false); repository.purgeArticle.mockResolvedValue(true);
    await expect(service.run({ batchSize: 999, correlationId: ' run-1 ' })).resolves.toEqual({ batchSize: 200, correlationId: 'run-1', assetsPurged: 1, commentsPurged: 0, articlesPurged: 1, skipped: 1 });
    expect(repository.listExpiredAssetIds).toHaveBeenCalledWith(now, 200);
    expect(repository.listExpiredCommentIds).toHaveBeenCalledWith(now, 199);
    expect(repository.listExpiredArticleIds).toHaveBeenCalledWith(now, 199);
    for (const purge of [repository.purgeAsset, repository.purgeComment, repository.purgeArticle]) expect(purge).toHaveBeenCalledWith(expect.any(String), now, 'run-1');

    repository.listExpiredAssetIds.mockClear();
    repository.listExpiredCommentIds.mockClear();
    repository.listExpiredArticleIds.mockClear();
    await expect(service.run({ batchSize: 1, correlationId: 'global-budget' }))
      .resolves.toMatchObject({ batchSize: 1, correlationId: 'global-budget', assetsPurged: 1 });
    expect(repository.listExpiredAssetIds).toHaveBeenCalledWith(now, 1);
    expect(repository.listExpiredCommentIds).not.toHaveBeenCalled();
    expect(repository.listExpiredArticleIds).not.toHaveBeenCalled();
    await expect(service.run({ batchSize: 0, correlationId: 'x' })).rejects.toThrow('invalid purge batch size');
    expect(repository.listExpiredAssetIds).toHaveBeenCalledTimes(1);

    const invalidConfigured = purgeSetup({ configuredBatch: 0 });
    await expect(invalidConfigured.service.run({ correlationId: 'configured-invalid' })).rejects.toThrow('invalid purge batch size');
    expect(invalidConfigured.repository.listExpiredAssetIds).not.toHaveBeenCalled();

    for (const invalid of [-1, 0.5, Number.NaN]) {
      const invalidRequested = purgeSetup();
      await expect(invalidRequested.service.run({ batchSize: invalid, correlationId: 'invalid-requested' })).rejects.toThrow('invalid purge batch size');
      expect(invalidRequested.repository.listExpiredAssetIds).not.toHaveBeenCalled();
    }

    for (const invalidCorrelation of [' ', 'invalid correlation', 'x'.repeat(129)]) {
      const invalid = purgeSetup();
      await expect(invalid.service.run({ batchSize: 1, correlationId: invalidCorrelation })).rejects.toThrow('invalid correlationId');
      expect(invalid.repository.listExpiredAssetIds).not.toHaveBeenCalled();
    }
  });

  it('enforces BOARD_MANAGE for legal-hold commands and records clock/correlation for managers', async () => {
    const denied = purgeSetup();
    await expect(denied.service.placeLegalHold({ actorUserId: actorId, subjectType: 'ARTICLE', subjectId: articleId, reasonCode: 'INVESTIGATION' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied.repository.placeLegalHold).not.toHaveBeenCalled();

    const { repository, permissions, service } = purgeSetup({ manager: true });
    await service.placeLegalHold({ actorUserId: actorId, subjectType: 'COMMENT', subjectId: commentId, reasonCode: 'LEGAL', correlationId: 'hold-1' });
    await service.releaseLegalHold('77777777-7777-4777-8777-777777777777', { actorUserId: actorId, correlationId: 'release-1' });
    expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, 'BOARD_MANAGE', 'GLOBAL');
    expect(repository.placeLegalHold).toHaveBeenCalledWith(expect.objectContaining({ occurredAt: now, correlationId: 'hold-1' }));
    expect(repository.releaseLegalHold).toHaveBeenCalledWith('77777777-7777-4777-8777-777777777777', expect.objectContaining({ occurredAt: now, correlationId: 'release-1' }));
  });
});
