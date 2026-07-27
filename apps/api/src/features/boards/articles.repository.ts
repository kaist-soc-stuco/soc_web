import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, lt, or } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { articles, boards, permissionAuditLog } from '../../infrastructure/postgres/postgres.schema';

export type ArticleRow = typeof articles.$inferSelect;
export type BoardRow = typeof boards.$inferSelect;
export type ArticleWithBoard = { article: ArticleRow; board: BoardRow };

@Injectable()
export class ArticlesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async findBoardByCode(code: string): Promise<BoardRow | null> {
    const [board] = await this.db.select().from(boards).where(eq(boards.code, code)).limit(1);
    return board ?? null;
  }

  async findArticleWithBoardById(id: string): Promise<ArticleWithBoard | null> {
    const [row] = await this.db.select({ article: articles, board: boards }).from(articles)
      .innerJoin(boards, eq(articles.boardId, boards.id))
      .where(eq(articles.id, id)).limit(1);
    return row ?? null;
  }

  async list(
    boardId: string,
    scopes: ArticleRow['scope'][],
    actorUserId: string | undefined,
    cursor: { isPinned: boolean; pinnedOrder: number | null; publishedAt: Date; id: string } | null,
    limit: number,
  ) {
    const afterPublished = (publishedAt: Date, id: string) => or(
      lt(articles.publishedAt, publishedAt),
      and(eq(articles.publishedAt, publishedAt), lt(articles.id, id)),
    );
    const after = cursor && (
      cursor.isPinned
        ? or(
          lt(articles.isPinned, true),
          and(eq(articles.isPinned, true), gt(articles.pinnedOrder, cursor.pinnedOrder!),),
          and(eq(articles.isPinned, true), eq(articles.pinnedOrder, cursor.pinnedOrder!), afterPublished(cursor.publishedAt, cursor.id)),
        )
        : and(eq(articles.isPinned, false), afterPublished(cursor.publishedAt, cursor.id))
    );
    const visibility = [
      eq(articles.boardId, boardId),
      eq(articles.status, 'PUBLISHED'),
      or(
        inArray(articles.scope, scopes),
        actorUserId ? and(eq(articles.scope, 'AUTHOR_AND_STAFF'), eq(articles.authorUserId, actorUserId)) : undefined,
      ),
      after || undefined,
    ].filter((value): value is NonNullable<typeof value> => value !== undefined);
    return this.db.select().from(articles).where(and(...visibility)).orderBy(desc(articles.isPinned), asc(articles.pinnedOrder), desc(articles.publishedAt), desc(articles.id)).limit(limit);
  }

  async create(
    boardCode: string,
    actorUserId: string,
    correlationId: string,
    buildCreate: (board: BoardRow) => Promise<typeof articles.$inferInsert>,
  ): Promise<ArticleWithBoard | null> {
    return this.db.transaction(async (tx) => {
      const [board] = await tx.select().from(boards).where(eq(boards.code, boardCode)).for('update');
      if (!board) return null;
      const [created] = await tx.insert(articles).values(await buildCreate(board)).returning();
      await this.audit(tx, actorUserId, 'ARTICLE_CREATED', created.id, 'record,title,body,scope,pinned', correlationId);
      return { article: created, board };
    });
  }

  async patch(
    id: string,
    actorUserId: string,
    correlationId: string,
    buildUpdate: (current: ArticleRow, board: BoardRow) => Promise<{ values: Partial<typeof articles.$inferInsert>; changedFieldNames: string }>,
  ): Promise<ArticleWithBoard | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(articles).where(eq(articles.id, id)).for('update');
      if (!current) return null;
      const [board] = await tx.select().from(boards).where(eq(boards.id, current.boardId)).for('update');
      if (!board) return null;
      const { values, changedFieldNames } = await buildUpdate(current, board);
      const [updated] = await tx.update(articles).set(values).where(eq(articles.id, id)).returning();
      await this.audit(tx, actorUserId, 'ARTICLE_UPDATED', updated.id, changedFieldNames, correlationId);
      return { article: updated, board };
    });
  }

  async publish(id: string, actorUserId: string, correlationId: string, buildUpdate: (current: ArticleRow, board: BoardRow) => Promise<Partial<typeof articles.$inferInsert>>): Promise<ArticleWithBoard | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(articles).where(eq(articles.id, id)).for('update');
      if (!current) return null;
      const [board] = await tx.select().from(boards).where(eq(boards.id, current.boardId)).for('update');
      if (!board) return null;
      const [updated] = await tx.update(articles).set(await buildUpdate(current, board)).where(eq(articles.id, id)).returning();
      await this.audit(tx, actorUserId, 'ARTICLE_PUBLISHED', updated.id, 'status,publishedAt', correlationId);
      return { article: updated, board };
    });
  }

  async softDelete(id: string, actorUserId: string, correlationId: string, buildUpdate: (current: ArticleRow, board: BoardRow) => Promise<Partial<typeof articles.$inferInsert>>): Promise<ArticleWithBoard | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(articles).where(eq(articles.id, id)).for('update');
      if (!current) return null;
      const [board] = await tx.select().from(boards).where(eq(boards.id, current.boardId)).for('update');
      if (!board) return null;
      const [updated] = await tx.update(articles).set(await buildUpdate(current, board)).where(eq(articles.id, id)).returning();
      await this.audit(tx, actorUserId, 'ARTICLE_SOFT_DELETED', updated.id, 'status,deletedAt,purgeAfter', correlationId);
      return { article: updated, board };
    });
  }

  private async audit(tx: Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0], actorUserId: string, action: string, recordId: string, changedFieldNames: string, correlationId: string): Promise<void> {
    await tx.insert(permissionAuditLog).values({ actorUserId, action, recordId, changedFieldNames, correlationId, reasonCode: 'BOARD_CONTENT' });
  }
}
