import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
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
import { notifications } from "../../infrastructure/postgres/postgres.schema";

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
    const offset = (page - 1) * pageSize;
    const [rows, totalRows, unreadRows] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
    ]);

    return {
      items: rows.map((row) => this.mapRow(row)),
      page,
      pageSize,
      total: Number(totalRows[0]?.count ?? 0),
      unreadCount: Number(unreadRows[0]?.count ?? 0),
    };
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
