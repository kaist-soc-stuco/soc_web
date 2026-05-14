import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import type { BoardSummary } from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { boards, permissions } from "../../../infrastructure/postgres/postgres.schema";

@Injectable()
export class BoardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  /**
   * permission FK를 JOIN하여 실제 bit_value를 반환합니다.
   * FK가 null이면 0 (제한 없음)을 반환합니다.
   */
  private async resolveBoardWithPermissions(
    rows: (typeof boards.$inferSelect)[],
  ): Promise<BoardSummary[]> {
    if (rows.length === 0) return [];

    // 보드에 연결된 permission FK 수집
    const permIds = new Set<number>();
    for (const row of rows) {
      if (row.writePermissionId) permIds.add(row.writePermissionId);
      if (row.commentPermissionId) permIds.add(row.commentPermissionId);
      if (row.managePermissionId) permIds.add(row.managePermissionId);
    }

    // FK → bitValue 맵 구축
    const bitMap = new Map<number, number>();

    if (permIds.size > 0) {
      const permRows = await this.db
        .select({
          permissionId: permissions.permissionId,
          bitValue: permissions.bitValue,
        })
        .from(permissions)
        .where(
          sql`${permissions.permissionId} IN (${sql.join(
            [...permIds].map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      for (const pr of permRows) {
        bitMap.set(pr.permissionId, Number(pr.bitValue));
      }
    }

    return rows.map((row) => ({
      boardId: row.boardId,
      code: row.code,
      nameKo: row.nameKo,
      nameEn: row.nameEn ?? undefined,
      description: row.description ?? undefined,
      readScope: row.readScope as BoardSummary["readScope"],
      writePermissionBit: row.writePermissionId
        ? bitMap.get(row.writePermissionId) ?? 0
        : 0,
      commentPermissionBit: row.commentPermissionId
        ? bitMap.get(row.commentPermissionId) ?? 0
        : 0,
      managePermissionBit: row.managePermissionId
        ? bitMap.get(row.managePermissionId) ?? 0
        : 0,
      allowComment: row.allowComment,
      allowSecret: row.allowSecret,
      allowLike: row.allowLike,
      isActive: row.isActive,
    }));
  }

  async listBoards(): Promise<BoardSummary[]> {
    const rows = await this.db.query.boards.findMany({
      where: eq(boards.isActive, true),
    });

    return this.resolveBoardWithPermissions(rows);
  }

  async findByCode(code: string): Promise<BoardSummary | null> {
    const row = await this.db.query.boards.findFirst({
      where: eq(boards.code, code),
    });

    if (!row) return null;

    const results = await this.resolveBoardWithPermissions([row]);
    return results[0] ?? null;
  }
}
