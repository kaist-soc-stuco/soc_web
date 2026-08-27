import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type {
  BoardCreateRequest,
  BoardSummary,
  BoardUpdateRequest,
} from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { articleDrafts, boards, permissions } from "../../../infrastructure/postgres/postgres.schema";

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

    // 게시글 작성에 사용되는 permission FK만 해석합니다.
    const permIds = new Set<number>();
    for (const row of rows) {
      if (row.writePermissionId) permIds.add(row.writePermissionId);
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
      descriptionKo: row.descriptionKo ?? undefined,
      descriptionEn: row.descriptionEn ?? undefined,
      writePermissionBit: row.writePermissionId
        ? bitMap.get(row.writePermissionId) ?? 0
        : 0,
      allowComment: row.allowComment,
      allowSecret: row.allowSecret,
      allowLike: row.allowLike,
      allowGuestRead: row.allowGuestRead,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    }));
  }

  async listBoards(): Promise<BoardSummary[]> {
    const rows = await this.db
      .select()
      .from(boards)
      .where(eq(boards.isActive, true))
      .orderBy(asc(boards.sortOrder), asc(boards.boardId));

    return this.resolveBoardWithPermissions(rows);
  }

  async listAllBoards(): Promise<BoardSummary[]> {
    const rows = await this.db
      .select()
      .from(boards)
      .orderBy(asc(boards.sortOrder), asc(boards.boardId));

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

  private async resolvePermissionIds(
    bits: number[],
  ): Promise<(number | null)[]> {
    const uniqueBits = [...new Set(bits.filter((bit) => bit > 0))];
    if (uniqueBits.length === 0) {
      return bits.map(() => null);
    }

    const rows = await this.db
      .select({ permissionId: permissions.permissionId, bitValue: permissions.bitValue })
      .from(permissions)
      .where(inArray(permissions.bitValue, uniqueBits));
    const idsByBit = new Map(rows.map((row) => [Number(row.bitValue), row.permissionId]));

    return bits.map((bit) => (bit > 0 ? idsByBit.get(bit) ?? null : null));
  }

  private async permissionIdsForInput(
    input: Pick<BoardCreateRequest, "writePermissionBit">,
  ): Promise<{
    writePermissionId: number | null;
  }> {
    const [writePermissionId] = await this.resolvePermissionIds([input.writePermissionBit]);

    return { writePermissionId };
  }

  async create(input: BoardCreateRequest): Promise<BoardSummary> {
    const permissionIds = await this.permissionIdsForInput(input);
    const [row] = await this.db
      .insert(boards)
      .values({
        code: input.code,
        nameKo: input.nameKo,
        nameEn: input.nameEn ?? null,
        descriptionKo: input.descriptionKo ?? null,
        descriptionEn: input.descriptionEn ?? null,
        ...permissionIds,
        allowComment: input.allowComment,
        allowSecret: input.allowSecret,
        allowLike: input.allowLike,
        allowGuestRead: input.allowGuestRead,
        sortOrder: input.sortOrder,
        isActive: true,
      })
      .returning();

    const [result] = await this.resolveBoardWithPermissions(row ? [row] : []);
    return result;
  }

  async update(code: string, input: BoardUpdateRequest): Promise<BoardSummary | null> {
    const set: Partial<typeof boards.$inferInsert> = {};

    if (input.nameKo !== undefined) set.nameKo = input.nameKo;
    if (input.nameEn !== undefined) set.nameEn = input.nameEn;
    if (input.descriptionKo !== undefined) set.descriptionKo = input.descriptionKo;
    if (input.descriptionEn !== undefined) set.descriptionEn = input.descriptionEn;
    if (input.allowComment !== undefined) set.allowComment = input.allowComment;
    if (input.allowSecret !== undefined) set.allowSecret = input.allowSecret;
    if (input.allowLike !== undefined) set.allowLike = input.allowLike;
    if (input.allowGuestRead !== undefined) set.allowGuestRead = input.allowGuestRead;
    if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) set.isActive = input.isActive;

    if (input.writePermissionBit !== undefined) {
      const current = await this.findByCode(code);
      if (!current) return null;
      const permissionIds = await this.permissionIdsForInput({
        writePermissionBit: input.writePermissionBit ?? current.writePermissionBit,
      });
      Object.assign(set, permissionIds);
    }

    if (Object.keys(set).length === 0) {
      return this.findByCode(code);
    }

    const [row] = await this.db
      .update(boards)
      .set(set)
      .where(eq(boards.code, code))
      .returning();
    if (!row) return null;

    const [result] = await this.resolveBoardWithPermissions([row]);
    return result ?? null;
  }

  async archive(code: string): Promise<BoardSummary | null> {
    const [row] = await this.db
      .update(boards)
      .set({ isActive: false })
      .where(eq(boards.code, code))
      .returning();
    if (!row) return null;

    const [result] = await this.resolveBoardWithPermissions([row]);
    return result ?? null;
  }

  async delete(code: string): Promise<BoardSummary | null> {
    const deleted = await this.db.transaction(async (tx) => {
      const board = await tx.query.boards.findFirst({
        where: eq(boards.code, code),
      });
      if (!board) return null;

      // Drafts intentionally use a restrictive FK, so remove them explicitly
      // before the board. Published article data is removed by its cascade FK.
      await tx.delete(articleDrafts).where(eq(articleDrafts.boardId, board.boardId));
      const [row] = await tx
        .delete(boards)
        .where(eq(boards.boardId, board.boardId))
        .returning();
      return row ?? null;
    });

    if (!deleted) return null;
    const [result] = await this.resolveBoardWithPermissions([deleted]);
    return result ?? null;
  }

  async reorder(items: Array<{ code: string; sortOrder: number }>): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(boards)
          .set({ sortOrder: item.sortOrder })
          .where(eq(boards.code, item.code));
      }
    });
  }
}
