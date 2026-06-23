import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogListResponse } from "@soc/contracts";
import { msToIso } from "@soc/shared";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { auditLogs, users } from "../../infrastructure/postgres/postgres.schema";

export interface AuditLogCreateInput {
  action: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  payload?: unknown;
  targetId?: string | number | null;
  targetType: string;
}

@Injectable()
export class AuditLogRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async create(input: AuditLogCreateInput): Promise<void> {
    await this.db.insert(auditLogs).values({
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      ipAddress: input.ipAddress ?? null,
      payload:
        input.payload === undefined ? null : JSON.stringify(input.payload),
      targetId:
        input.targetId === undefined || input.targetId === null
          ? null
          : String(input.targetId),
      targetType: input.targetType,
    });
  }

  async list(input: {
    action?: string;
    page?: number;
    pageSize?: number;
    query?: string;
    sortBy?: "createdAt" | "actor" | "action";
    sortDirection?: "asc" | "desc";
    targetType?: string;
  }): Promise<AuditLogListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.query?.trim() ?? "";
    const normalizedAction = input.action?.trim() ?? "";
    const normalizedTargetType = input.targetType?.trim() ?? "";
    const conditions = [
      normalizedQuery
        ? or(
            ilike(auditLogs.action, `%${normalizedQuery}%`),
            ilike(auditLogs.targetType, `%${normalizedQuery}%`),
            ilike(auditLogs.targetId, `%${normalizedQuery}%`),
            ilike(users.nameKo, `%${normalizedQuery}%`),
            ilike(users.email, `%${normalizedQuery}%`),
          )
        : undefined,
      normalizedAction ? eq(auditLogs.action, normalizedAction) : undefined,
      normalizedTargetType
        ? eq(auditLogs.targetType, normalizedTargetType)
        : undefined,
    ].filter(Boolean);
    const whereClause =
      conditions.length === 0 ? undefined : and(...conditions);
    const direction = input.sortDirection === "asc" ? asc : desc;
    const sortBy = input.sortBy ?? "createdAt";
    const primarySort =
      sortBy === "actor"
        ? direction(users.nameKo)
        : sortBy === "action"
          ? direction(auditLogs.action)
          : direction(auditLogs.createdAt);

    const rows = await this.db
      .select({
        action: auditLogs.action,
        actorNameKo: users.nameKo,
        actorUserId: auditLogs.actorUserId,
        auditLogId: auditLogs.auditLogId,
        createdAt: auditLogs.createdAt,
        ipAddress: auditLogs.ipAddress,
        payload: auditLogs.payload,
        targetId: auditLogs.targetId,
        targetType: auditLogs.targetType,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.userId))
      .where(whereClause)
      .orderBy(primarySort, desc(auditLogs.createdAt), desc(auditLogs.auditLogId))
      .limit(pageSize)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.userId))
      .where(whereClause);

    return {
      items: rows.map((row) => ({
        action: row.action,
        actorNameKo: row.actorNameKo ?? null,
        actorUserId: row.actorUserId ?? null,
        auditLogId: row.auditLogId,
        createdAt: msToIso(row.createdAt.valueOf()),
        ipAddress: row.ipAddress ?? null,
        payload: row.payload ?? null,
        targetId: row.targetId ?? null,
        targetType: row.targetType,
      })),
      page,
      pageSize,
      total: Number(countResult[0]?.count ?? 0),
    };
  }
}
