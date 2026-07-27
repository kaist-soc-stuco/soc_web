import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import {
  articleReactions,
  articles,
  assets,
  boards,
  comments,
  permissionAuditLog,
} from '../../infrastructure/postgres/postgres.schema';

@Injectable()
export class InteractionsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}



  async readArticleDetail(
    articleId: string,
    userId: string | undefined,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect }) => Promise<{ canReadSecretComments: boolean }>,
  ) {
    return this.db.transaction(async (tx) => {
      const article = await this.lockArticleWithBoard(tx, articleId);
      if (!article) return null;
      const access = await validate(article);
      const [commentRows, assetRows, reaction] = await Promise.all([
        tx.select({
          id: comments.id,
          articleId: comments.articleId,
          parentCommentId: comments.parentCommentId,
          authorUserId: comments.authorUserId,
          body: comments.body,
          status: comments.status,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
        }).from(comments).where(eq(comments.articleId, articleId)).orderBy(comments.createdAt, comments.id),
        tx.select({
          id: assets.id,
          articleId: assets.articleId,
          displayOrder: assets.displayOrder,
          type: assets.type,
          status: assets.status,
          contentType: assets.contentType,
          byteSize: assets.byteSize,
          checksumSha256: assets.checksumSha256,
          completedAt: assets.completedAt,
        }).from(assets)
          .where(and(eq(assets.articleId, articleId), eq(assets.status, 'COMPLETED'), isNull(assets.deletedAt)))
          .orderBy(assets.displayOrder, assets.id),
        userId
          ? tx.select({ type: articleReactions.type }).from(articleReactions)
            .where(and(eq(articleReactions.articleId, articleId), eq(articleReactions.userId, userId))).limit(1)
          : Promise.resolve([]),
      ]);
      return { comments: commentRows, assets: assetRows, reaction: reaction[0] ?? null, ...access };
    });
  }
  async readPublishedArticleComments(
    articleId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect }) => Promise<{ canReadSecretComments: boolean }>,
  ) {
    return this.db.transaction(async (tx) => {
      const article = await this.lockArticleWithBoard(tx, articleId);
      if (!article) return null;
      const access = await validate(article);
      const commentRows = await tx.select({
        id: comments.id,
        articleId: comments.articleId,
        parentCommentId: comments.parentCommentId,
        authorUserId: comments.authorUserId,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      }).from(comments).where(eq(comments.articleId, articleId)).orderBy(comments.createdAt, comments.id);
      return { comments: commentRows, ...access };
    });
  }

  async createComment(
    input: typeof comments.$inferInsert,
    correlationId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect; parent: typeof comments.$inferSelect | null }) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const article = await this.lockArticleWithBoard(tx, input.articleId);
      if (!article) return null;
      const parent = input.parentCommentId
        ? (await tx.select().from(comments).where(eq(comments.id, input.parentCommentId)).for('update'))[0] ?? null
        : null;
      await validate({ ...article, parent });
      const [created] = await tx.insert(comments).values(input).returning();
      await this.audit(tx, input.authorUserId, 'COMMENT_CREATED', created.id, 'body,status,parentCommentId', correlationId);
      return created;
    });
  }

  async patchComment(
    commentId: string,
    actorUserId: string,
    values: Partial<Pick<typeof comments.$inferInsert, 'body' | 'status' | 'updatedAt'>>,
    changedFieldNames: string,
    correlationId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect; comment: typeof comments.$inferSelect }) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const initial = (await tx.select({ articleId: comments.articleId }).from(comments).where(eq(comments.id, commentId)).limit(1))[0] ?? null;
      if (!initial) return null;
      const article = await this.lockArticleWithBoard(tx, initial.articleId);
      if (!article) return null;
      const current = (await tx.select().from(comments).where(eq(comments.id, commentId)).for('update'))[0] ?? null;
      if (!current || current.articleId !== article.article.id) return null;
      await validate({ ...article, comment: current });
      const [updated] = await tx.update(comments).set(values).where(eq(comments.id, commentId)).returning();
      await this.audit(tx, actorUserId, 'COMMENT_UPDATED', updated.id, changedFieldNames, correlationId);
      return updated;
    });
  }

  async softDeleteComment(
    commentId: string,
    actorUserId: string,
    now: Date,
    purgeAfter: Date,
    correlationId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect; comment: typeof comments.$inferSelect }) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const initial = (await tx.select({ articleId: comments.articleId }).from(comments).where(eq(comments.id, commentId)).limit(1))[0] ?? null;
      if (!initial) return null;
      const article = await this.lockArticleWithBoard(tx, initial.articleId);
      if (!article) return null;
      const current = (await tx.select().from(comments).where(eq(comments.id, commentId)).for('update'))[0] ?? null;
      if (!current || current.articleId !== article.article.id) return null;
      await validate({ ...article, comment: current });
      if (current.status === 'DELETED') return current;
      const [updated] = await tx.update(comments).set({ status: 'DELETED', deletedAt: now, purgeAfter, updatedAt: now })
        .where(eq(comments.id, commentId)).returning();
      await this.audit(tx, actorUserId, 'COMMENT_DELETED', updated.id, 'status,deletedAt,purgeAfter', correlationId);
      return updated;
    });
  }

  async putReaction(
    articleId: string,
    userId: string,
    type: 'LIKE' | 'DISLIKE',
    now: Date,
    correlationId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect }) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const article = await this.lockArticleWithBoard(tx, articleId);
      if (!article) return null;
      await validate(article);
      await tx.insert(articleReactions).values({ articleId, userId, type, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: [articleReactions.articleId, articleReactions.userId], set: { type, updatedAt: now } });
      await this.audit(tx, userId, 'REACTION_PUT', articleId, 'type', correlationId);
      return true;
    });
  }

  async deleteReaction(
    articleId: string,
    userId: string,
    correlationId: string,
    validate: (state: { article: typeof articles.$inferSelect; board: typeof boards.$inferSelect }) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const article = await this.lockArticleWithBoard(tx, articleId);
      if (!article) return { kind: 'article_not_found' as const };
      await validate(article);
      const [deleted] = await tx.delete(articleReactions)
        .where(and(eq(articleReactions.articleId, articleId), eq(articleReactions.userId, userId)))
        .returning();
      if (!deleted) return { kind: 'reaction_not_found' as const };
      await this.audit(tx, userId, 'REACTION_DELETED', articleId, 'type', correlationId);
      return { kind: 'deleted' as const };
    });
  }

  private async lockArticleWithBoard(
    tx: Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0],
    articleId: string,
  ) {
    const [row] = await tx
      .select({ article: articles, board: boards })
      .from(articles)
      .innerJoin(boards, eq(articles.boardId, boards.id))
      .where(eq(articles.id, articleId))
      .for('share')
      .limit(1);
    return row ?? null;
  }

  private async audit(
    tx: Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0],
    actorUserId: string,
    action: string,
    recordId: string,
    changedFieldNames: string,
    correlationId: string,
  ) {
    await tx.insert(permissionAuditLog).values({
      actorUserId,
      action,
      recordId,
      changedFieldNames,
      correlationId,
      reasonCode: 'BOARD_INTERACTION',
    });
  }
}
