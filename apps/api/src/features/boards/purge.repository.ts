import { Inject, Injectable } from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, eq, isNull, lte, notExists, or } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import {
  articleReactions,
  articles,
  assets,
  comments,
  legalHolds,
  purgeAuditLog,
} from '../../infrastructure/postgres/postgres.schema';
import type { LegalHoldSubject, PlaceLegalHoldInput, ReleaseLegalHoldInput } from './purge.types';

const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const childComments = alias(comments, 'purge_child_comments');

type Candidate = { id: string };
type Transaction = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];

@Injectable()
export class PurgeRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  listExpiredAssetIds(now: Date, limit: number): Promise<Candidate[]> {
    return this.db.select({ id: assets.id }).from(assets)
      .innerJoin(articles, eq(assets.articleId, articles.id))
      .where(and(
        eq(assets.status, 'DELETED'),
        eq(assets.objectDeletionStatus, 'DELETED'),
        lte(assets.purgeAfter, now),
        notExists(this.db.select({ id: legalHolds.id }).from(legalHolds).where(and(
          eq(legalHolds.status, 'ACTIVE'),
          or(eq(legalHolds.assetId, assets.id), eq(legalHolds.articleId, assets.articleId)),
        ))),
      ))
      .orderBy(asc(assets.purgeAfter), asc(assets.id)).limit(limit);
  }

  listExpiredCommentIds(now: Date, limit: number): Promise<Candidate[]> {
    return this.db.select({ id: comments.id }).from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.id))
      .where(and(
        eq(comments.status, 'DELETED'),
        lte(comments.purgeAfter, now),
        notExists(this.db.select({ id: legalHolds.id }).from(legalHolds).where(and(
          eq(legalHolds.status, 'ACTIVE'),
          or(eq(legalHolds.commentId, comments.id), eq(legalHolds.articleId, comments.articleId)),
        ))),
        notExists(this.db.select({ id: childComments.id }).from(childComments)
          .where(eq(childComments.parentCommentId, comments.id))),
      ))
      .orderBy(asc(comments.purgeAfter), asc(comments.id)).limit(limit);
  }

  listExpiredArticleIds(now: Date, limit: number): Promise<Candidate[]> {
    return this.db.select({ id: articles.id }).from(articles)
      .where(and(
        eq(articles.status, 'DELETED'),
        lte(articles.purgeAfter, now),
        notExists(this.db.select({ id: legalHolds.id }).from(legalHolds).where(and(
          eq(legalHolds.status, 'ACTIVE'),
          eq(legalHolds.articleId, articles.id),
        ))),
        notExists(this.db.select({ id: assets.id }).from(assets)
          .where(eq(assets.articleId, articles.id))),
        notExists(this.db.select({ id: comments.id }).from(comments)
          .where(eq(comments.articleId, articles.id))),
      ))
      .orderBy(asc(articles.purgeAfter), asc(articles.id)).limit(limit);
  }

  async purgeAsset(id: string, now: Date, correlationId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.select({ articleId: assets.articleId }).from(assets).where(eq(assets.id, id));
      if (!candidate) return false;
      const [parent] = await tx.select({ id: articles.id }).from(articles)
        .where(eq(articles.id, candidate.articleId)).for('update');
      if (!parent) return false;
      const [asset] = await tx.select({
        id: assets.id,
        articleId: assets.articleId,
        purgeAfter: assets.purgeAfter,
        status: assets.status,
        objectDeletionStatus: assets.objectDeletionStatus,
      })
        .from(assets).where(eq(assets.id, id)).for('update', { skipLocked: true });
      if (
        !asset
        || asset.articleId !== parent.id
        || asset.status !== 'DELETED'
        || asset.objectDeletionStatus !== 'DELETED'
        || !asset.purgeAfter
        || asset.purgeAfter > now
      ) return false;
      if (
        await this.hasActiveHold(tx, { subjectType: 'ARTICLE', subjectId: parent.id })
        || await this.hasActiveHold(tx, { subjectType: 'ASSET', subjectId: id })
      ) return false;

      await tx.delete(assets).where(eq(assets.id, id));
      await this.audit(tx, 'ASSET', id, 'PURGED', null, null, correlationId, now);
      return true;
    });
  }

  async purgeComment(id: string, now: Date, correlationId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.select({ articleId: comments.articleId }).from(comments).where(eq(comments.id, id));
      if (!candidate) return false;
      const [parent] = await tx.select({ id: articles.id }).from(articles)
        .where(eq(articles.id, candidate.articleId)).for('update');
      if (!parent) return false;
      const [comment] = await tx.select({ id: comments.id, articleId: comments.articleId, purgeAfter: comments.purgeAfter, status: comments.status })
        .from(comments).where(eq(comments.id, id)).for('update', { skipLocked: true });
      if (!comment || comment.articleId !== parent.id || comment.status !== 'DELETED' || !comment.purgeAfter || comment.purgeAfter > now) return false;
      if (
        await this.hasActiveHold(tx, { subjectType: 'ARTICLE', subjectId: parent.id })
        || await this.hasActiveHold(tx, { subjectType: 'COMMENT', subjectId: id })
      ) return false;
      const [child] = await tx.select({ id: comments.id }).from(comments)
        .where(eq(comments.parentCommentId, id)).limit(1).for('update');
      if (child) return false;

      await tx.delete(comments).where(eq(comments.id, id));
      await this.audit(tx, 'COMMENT', id, 'PURGED', null, null, correlationId, now);
      return true;
    });
  }

  async purgeArticle(id: string, now: Date, correlationId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [article] = await tx.select({ id: articles.id, purgeAfter: articles.purgeAfter, status: articles.status })
        .from(articles).where(eq(articles.id, id)).for('update', { skipLocked: true });
      if (!article || article.status !== 'DELETED' || !article.purgeAfter || article.purgeAfter > now) return false;
      if (await this.hasActiveHold(tx, { subjectType: 'ARTICLE', subjectId: id })) return false;

      const articleAssets = await tx.select({ id: assets.id }).from(assets)
        .where(eq(assets.articleId, id)).for('update');
      const articleComments = await tx.select({ id: comments.id }).from(comments)
        .where(eq(comments.articleId, id)).for('update');
      // Retain every child record until its own eligible, unheld purge transaction succeeds.
      if (articleAssets.length > 0 || articleComments.length > 0) return false;

      await tx.delete(articleReactions).where(eq(articleReactions.articleId, id));
      await tx.delete(articles).where(eq(articles.id, id));
      await this.audit(tx, 'ARTICLE', id, 'PURGED', null, null, correlationId, now);
      return true;
    });
  }

  async placeLegalHold(input: PlaceLegalHoldInput) {
    this.assertReasonCode(input.reasonCode);
    return this.db.transaction(async (tx) => {
      const exists = await this.lockSubject(tx, input);
      if (!exists) return null;
      const [hold] = await tx.insert(legalHolds).values({
        ...this.subjectColumns(input),
        reasonCode: input.reasonCode,
        placedByUserId: input.actorUserId,
        createdAt: input.occurredAt,
      }).returning();
      await this.audit(tx, input.subjectType, input.subjectId, 'HELD', input.actorUserId, hold.id, input.correlationId, input.occurredAt);
      return hold;
    });
  }

  async releaseLegalHold(id: string, input: ReleaseLegalHoldInput) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select({
        articleId: legalHolds.articleId,
        commentId: legalHolds.commentId,
        assetId: legalHolds.assetId,
      }).from(legalHolds).where(eq(legalHolds.id, id));
      if (!existing) return null;

      const subject = this.holdSubject(existing);
      if (!await this.lockSubject(tx, subject)) return null;

      const [hold] = await tx.select().from(legalHolds).where(eq(legalHolds.id, id)).for('update');
      if (!hold || hold.status !== 'ACTIVE') return null;
      const [released] = await tx.update(legalHolds).set({
        status: 'RELEASED', releasedByUserId: input.actorUserId, releasedAt: input.occurredAt,
      }).where(eq(legalHolds.id, id)).returning();
      await this.audit(tx, subject.subjectType, subject.subjectId, 'CANCELLED', input.actorUserId, id, input.correlationId, input.occurredAt);
      return released;
    });
  }

  private async hasActiveHold(tx: Transaction, subject: LegalHoldSubject): Promise<boolean> {
    const columns = this.subjectColumns(subject);
    const [hold] = await tx.select({ id: legalHolds.id }).from(legalHolds)
      .where(and(
        eq(legalHolds.status, 'ACTIVE'),
        columns.articleId ? eq(legalHolds.articleId, columns.articleId) : isNull(legalHolds.articleId),
        columns.commentId ? eq(legalHolds.commentId, columns.commentId) : isNull(legalHolds.commentId),
        columns.assetId ? eq(legalHolds.assetId, columns.assetId) : isNull(legalHolds.assetId),
      ))
      .for('update');
    return Boolean(hold);
  }

  private async lockSubject(tx: Transaction, subject: LegalHoldSubject): Promise<boolean> {
    if (subject.subjectType === 'ARTICLE') {
      return Boolean((await tx.select({ id: articles.id }).from(articles).where(eq(articles.id, subject.subjectId)).for('update'))[0]);
    }
    if (subject.subjectType === 'COMMENT') {
      return Boolean((await tx.select({ id: comments.id }).from(comments).where(eq(comments.id, subject.subjectId)).for('update'))[0]);
    }
    return Boolean((await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, subject.subjectId)).for('update'))[0]);
  }

  private subjectColumns(subject: LegalHoldSubject) {
    return subject.subjectType === 'ARTICLE'
      ? { articleId: subject.subjectId, commentId: null, assetId: null }
      : subject.subjectType === 'COMMENT'
        ? { articleId: null, commentId: subject.subjectId, assetId: null }
        : { articleId: null, commentId: null, assetId: subject.subjectId };
  }

  private holdSubject(hold: { articleId: string | null; commentId: string | null; assetId: string | null }): LegalHoldSubject {
    if (hold.articleId) return { subjectType: 'ARTICLE', subjectId: hold.articleId };
    if (hold.commentId) return { subjectType: 'COMMENT', subjectId: hold.commentId };
    return { subjectType: 'ASSET', subjectId: hold.assetId! };
  }

  private async audit(
    tx: Transaction,
    subjectType: LegalHoldSubject['subjectType'],
    subjectId: string,
    action: 'HELD' | 'CANCELLED' | 'PURGED',
    actorUserId: string | null,
    legalHoldId: string | null,
    correlationId: string,
    occurredAt: Date,
  ) {
    await tx.insert(purgeAuditLog).values({
      subjectType, subjectId, action, actorUserId, legalHoldId, correlationId, occurredAt,
    });
  }

  private assertReasonCode(reasonCode: string) {
    if (!REASON_CODE_PATTERN.test(reasonCode)) throw new Error('Legal hold reason code must be a technical identifier');
  }
}
