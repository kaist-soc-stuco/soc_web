import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNotNull, lte } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { articles, boards, permissionAuditLog } from '../../infrastructure/postgres/postgres.schema';

type BoardCreateValues = Pick<typeof boards.$inferSelect,
  'code' | 'titleKr' | 'titleEn' | 'descriptionKr' | 'descriptionEn' |
  'readPermission' | 'writePermission' | 'commentPermission' | 'commentsAllowed' |
  'secretArticlesAllowed' | 'reactionsAllowed' | 'displayOrder' | 'isHidden' | 'showOnHome'>;

export type BoardMutation = {
  actorUserId: string;
  correlationId: string;
  now: Date;
  expectedUpdatedAt: string;
  values: Partial<typeof boards.$inferInsert>;
  changedFieldNames: string;
};

export type BoardCreateMutation = Omit<BoardMutation, 'values' | 'expectedUpdatedAt'> & {
  values: BoardCreateValues;
};

@Injectable()
export class BoardsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  listVisible() {
    return this.db.select().from(boards)
      .where(eq(boards.isHidden, false))
      .orderBy(asc(boards.displayOrder), asc(boards.id));
  }
  listAll() {
    return this.db.select().from(boards)
      .orderBy(asc(boards.displayOrder), asc(boards.id));
  }


  async listVisibleHomeWithLatest(now: Date, latestLimit: number) {
    const visibleBoards = await this.db.select().from(boards)
      .where(and(eq(boards.isHidden, false), eq(boards.showOnHome, true)))
      .orderBy(asc(boards.displayOrder), asc(boards.id));
    if (visibleBoards.length === 0) return [];

    const latestArticles = await this.db.select().from(articles)
      .where(and(
        inArray(articles.boardId, visibleBoards.map((board) => board.id)),
        eq(articles.status, 'PUBLISHED'),
        eq(articles.scope, 'ALL'),
        isNotNull(articles.publishedAt),
        lte(articles.publishedAt, now),
      ))
      .orderBy(articles.boardId, desc(articles.publishedAt), desc(articles.updatedAt), desc(articles.id));

    const latestByBoardId = new Map<string, typeof latestArticles>();
    for (const article of latestArticles) {
      const existing = latestByBoardId.get(article.boardId) ?? [];
      if (existing.length < latestLimit) latestByBoardId.set(article.boardId, [...existing, article]);
    }
    return visibleBoards.map((board) => ({ board, latest: latestByBoardId.get(board.id) ?? [] }));
  }

  async findVisibleByCode(code: string) {
    const [board] = await this.db.select().from(boards)
      .where(and(eq(boards.code, code), eq(boards.isHidden, false))).limit(1);
    return board ?? null;
  }

  async create(input: BoardCreateMutation) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(boards).values({ ...input.values, createdAt: input.now, updatedAt: input.now }).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'BOARD_CREATED',
        recordId: created.id,
        changedFieldNames: input.changedFieldNames,
        correlationId: input.correlationId,
        reasonCode: 'BOARD_ADMIN',
      });
      return created;
    });
  }

  async patch(id: string, input: BoardMutation) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(boards).where(eq(boards.id, id)).for('update');
      if (!current) return null;
      if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) return 'stale' as const;
      const nextUpdatedAt = new Date(Math.max(input.now.getTime(), current.updatedAt.getTime() + 1));
      const [updated] = await tx.update(boards).set({ ...input.values, updatedAt: nextUpdatedAt }).where(eq(boards.id, id)).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'BOARD_UPDATED',
        recordId: updated.id,
        changedFieldNames: input.changedFieldNames,
        correlationId: input.correlationId,
        reasonCode: 'BOARD_ADMIN',
      });
      return updated;
    });
  }

  async delete(id: string, actorUserId: string, correlationId: string, expectedUpdatedAt: string): Promise<'deleted' | 'has_articles' | 'missing' | 'stale'> {
    return this.db.transaction(async (tx) => {
      const [board] = await tx.select().from(boards).where(eq(boards.id, id)).for('update');
      if (!board) return 'missing';
      if (board.updatedAt.toISOString() !== expectedUpdatedAt) return 'stale';
      const [article] = await tx.select({ id: articles.id }).from(articles).where(eq(articles.boardId, id)).limit(1);
      if (article) return 'has_articles';
      await tx.delete(boards).where(eq(boards.id, id));
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'BOARD_DELETED',
        recordId: board.id,
        changedFieldNames: 'record',
        correlationId,
        reasonCode: 'BOARD_ADMIN',
      });
      return 'deleted';
    });
  }
}
