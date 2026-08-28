import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import type {
  NotificationListResponse,
  NotificationRecord,
  NotificationType,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  articles,
  boards,
  notifications,
} from "../../infrastructure/postgres/postgres.schema";

interface NotificationArticleTarget {
  boardCode: string;
  articleId: string;
}

function parseArticleTarget(link: string | null): NotificationArticleTarget | null {
  if (!link) return null;

  const pathname = link.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "events" && segments.length === 2) {
    try {
      return {
        boardCode: "_EVENT",
        articleId: decodeURIComponent(segments[1]),
      };
    } catch {
      return null;
    }
  }

  if (segments[0] === "board" && segments.length === 3) {
    try {
      return {
        boardCode: decodeURIComponent(segments[1]),
        articleId: decodeURIComponent(segments[2]),
      };
    } catch {
      return null;
    }
  }

  return null;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapRow(row: typeof notifications.$inferSelect): NotificationRecord {
    return {
      notificationId: row.notificationId,
      type: row.type as NotificationType,
      titleKo: row.titleKo,
      bodyKo: row.bodyKo,
      link: row.link,
      isRead: row.isRead,
      readAt: row.readAt ? msToIso(row.readAt.valueOf()) : null,
      createdAt: msToIso(row.createdAt.valueOf()),
    };
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationListResponse> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    const articleTargets = rows
      .map((row) => parseArticleTarget(row.link))
      .filter((target): target is NotificationArticleTarget => Boolean(target));
    const articleIds = [
      ...new Set(
        articleTargets
          .map((target) => Number(target.articleId))
          .filter((articleId) => Number.isInteger(articleId) && articleId > 0),
      ),
    ];
    const existingArticles = articleIds.length
      ? await this.db
          .select({ articleId: articles.articleId, boardCode: boards.code })
          .from(articles)
          .innerJoin(boards, eq(boards.boardId, articles.boardId))
          .where(
            and(
              inArray(articles.articleId, articleIds),
              eq(articles.status, "PUBLISHED"),
              eq(boards.isActive, true),
            ),
          )
      : [];
    const existingArticleKeys = new Set(
      existingArticles.map((article) => `${article.boardCode}:${article.articleId}`),
    );
    const visibleRows = rows.filter((row) => {
      const target = parseArticleTarget(row.link);
      if (!target) return true;
      return existingArticleKeys.has(`${target.boardCode}:${target.articleId}`);
    });
    const offset = (page - 1) * pageSize;
    const pageRows = visibleRows.slice(offset, offset + pageSize);

    return {
      items: pageRows.map((row) => this.mapRow(row)),
      page,
      pageSize,
      total: visibleRows.length,
      unreadCount: visibleRows.filter((row) => !row.isRead).length,
    };
  }

  async deleteForArticle(boardCode: string, articleId: string): Promise<void> {
    const encodedBoardCode = encodeURIComponent(boardCode);
    const encodedArticleId = encodeURIComponent(articleId);
    const paths = [
      boardCode === "_EVENT"
        ? `/events/${encodedArticleId}`
        : `/board/${encodedBoardCode}/${encodedArticleId}`,
      boardCode === "_EVENT"
        ? `/board/${encodedBoardCode}/${encodedArticleId}`
        : `/board/${boardCode}/${articleId}`,
    ];

    await this.db.delete(notifications).where(
      or(
        ...paths.flatMap((path) => [
          eq(notifications.link, path),
          like(notifications.link, `${path}#%`),
        ]),
      ),
    );
  }

  async create(input: {
    userId: string;
    actorUserId?: string;
    type: NotificationType;
    titleKo: string;
    bodyKo?: string | null;
    link?: string | null;
  }): Promise<NotificationRecord> {
    const [row] = await this.db
      .insert(notifications)
      .values({
        actorUserId: input.actorUserId ?? null,
        bodyKo: input.bodyKo ?? null,
        link: input.link ?? null,
        titleKo: input.titleKo,
        type: input.type,
        userId: input.userId,
      })
      .returning();

    return this.mapRow(row);
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationRecord | null> {
    const readAt = nowDate();
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true, readAt })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning();

    return row ? this.mapRow(row) : null;
  }

  async markAllRead(userId: string): Promise<number> {
    const readAt = nowDate();
    const rows = await this.db
      .update(notifications)
      .set({ isRead: true, readAt })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ notificationId: notifications.notificationId });

    return rows.length;
  }
}
