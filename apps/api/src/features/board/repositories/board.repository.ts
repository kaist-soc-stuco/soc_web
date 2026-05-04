import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { BoardSummary } from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { boards } from "../../../infrastructure/postgres/postgres.schema";

@Injectable()
export class BoardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapRow(row: typeof boards.$inferSelect): BoardSummary {
    return {
      boardId: row.boardId,
      code: row.code,
      nameKo: row.nameKo,
      nameEn: row.nameEn ?? undefined,
      description: row.description ?? undefined,
      readScope: row.readScope as BoardSummary["readScope"],
      writePermissionId: row.writePermissionId,
      commentPermissionId: row.commentPermissionId,
      managePermissionId: row.managePermissionId,
      allowComment: row.allowComment,
      allowSecret: row.allowSecret,
      allowLike: row.allowLike,
      isActive: row.isActive,
    };
  }

  async listBoards(): Promise<BoardSummary[]> {
    const rows = await this.db.query.boards.findMany({
      where: eq(boards.isActive, true),
    });

    return rows.map((row) => this.mapRow(row));
  }

  async findByCode(code: string): Promise<BoardSummary | null> {
    const row = await this.db.query.boards.findFirst({
      where: eq(boards.code, code),
    });

    return row ? this.mapRow(row) : null;
  }
}
