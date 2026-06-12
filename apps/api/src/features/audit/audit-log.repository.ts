import { Inject, Injectable } from "@nestjs/common";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { auditLogs } from "../../infrastructure/postgres/postgres.schema";

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
}
