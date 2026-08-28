import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { asc, and, eq, inArray, sql } from "drizzle-orm";
import { Permissions, type BoardCreateRequest, type BoardSummary, type BoardUpdateRequest } from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleDrafts,
  boardRoleGroups,
  boards,
  permissions,
  roleGroups,
} from "../../../infrastructure/postgres/postgres.schema";

export interface BoardViewer {
  permission: number;
  roleGroupIds?: number[];
}

@Injectable()
export class BoardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private async resolveBoardWithPermissions(
    rows: (typeof boards.$inferSelect)[],
    viewer?: BoardViewer,
  ): Promise<BoardSummary[]> {
    if (rows.length === 0) return [];

    const boardIds = rows.map((row) => row.boardId);
    const mappings = await this.db
      .select({ boardId: boardRoleGroups.boardId, roleGroupId: boardRoleGroups.roleGroupId })
      .from(boardRoleGroups)
      .where(
        and(
          inArray(boardRoleGroups.boardId, boardIds),
          eq(boardRoleGroups.isActive, true),
        ),
      );

    const roleGroupIdsByBoard = new Map<number, number[]>();
    for (const mapping of mappings) {
      const current = roleGroupIdsByBoard.get(mapping.boardId) ?? [];
      current.push(mapping.roleGroupId);
      roleGroupIdsByBoard.set(mapping.boardId, current);
    }

    const permissionIds = new Set<number>();
    for (const row of rows) {
      if (row.writePermissionId) permissionIds.add(row.writePermissionId);
    }

    const bitMap = new Map<number, number>();
    if (permissionIds.size > 0) {
      const permissionRows = await this.db
        .select({ permissionId: permissions.permissionId, bitValue: permissions.bitValue })
        .from(permissions)
        .where(inArray(permissions.permissionId, [...permissionIds]));

      for (const permissionRow of permissionRows) {
        bitMap.set(permissionRow.permissionId, Number(permissionRow.bitValue));
      }
    }

    return rows.map((row) => {
      const writeRoleGroupIds = roleGroupIdsByBoard.get(row.boardId) ?? [];
      const canWrite = viewer
        ? Permissions.has(viewer.permission, Permissions.SUPER_ADMIN) ||
          (Permissions.has(viewer.permission, Permissions.POST_CREATE) &&
            writeRoleGroupIds.some((roleGroupId) =>
              (viewer.roleGroupIds ?? []).includes(roleGroupId),
            ))
        : undefined;
      const canUseOfficialIdentity = viewer
        ? Permissions.has(viewer.permission, Permissions.SUPER_ADMIN) ||
          Permissions.has(viewer.permission, Permissions.POST_OFFICIAL)
        : undefined;

      return {
        boardId: row.boardId,
        code: row.code,
        nameKo: row.nameKo,
        nameEn: row.nameEn ?? undefined,
        descriptionKo: row.descriptionKo ?? undefined,
        descriptionEn: row.descriptionEn ?? undefined,
        // Legacy fields remain in the response for old clients and old rows.
        writeAccessType:
          writeRoleGroupIds.length > 0
            ? "ROLE_GROUP"
            : row.writeAccessType === "EXECUTIVE" ||
                row.writeAccessType === "PERMISSION"
              ? row.writeAccessType
              : "AUTHENTICATED",
        writePermissionBit: row.writePermissionId
          ? bitMap.get(row.writePermissionId) ?? 0
          : 0,
        writeRoleGroupIds,
        ...(canWrite === undefined ? {} : { canWrite }),
        ...(canUseOfficialIdentity === undefined
          ? {}
          : { canUseOfficialIdentity }),
        allowComment: row.allowComment,
        allowOfficialReply: row.allowOfficialReply,
        allowSecret: row.allowSecret,
        allowLike: row.allowLike,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      };
    });
  }

  async listBoards(viewer?: BoardViewer): Promise<BoardSummary[]> {
    const rows = await this.db
      .select()
      .from(boards)
      .where(eq(boards.isActive, true))
      .orderBy(asc(boards.sortOrder), asc(boards.boardId));

    return this.resolveBoardWithPermissions(rows, viewer);
  }

  async listAllBoards(viewer?: BoardViewer): Promise<BoardSummary[]> {
    const rows = await this.db
      .select()
      .from(boards)
      .orderBy(asc(boards.sortOrder), asc(boards.boardId));

    return this.resolveBoardWithPermissions(rows, viewer);
  }

  async findByCode(code: string, viewer?: BoardViewer): Promise<BoardSummary | null> {
    const row = await this.db.query.boards.findFirst({
      where: eq(boards.code, code),
    });

    if (!row) return null;

    const [result] = await this.resolveBoardWithPermissions([row], viewer);
    return result ?? null;
  }

  private async resolvePermissionIds(bits: number[]): Promise<(number | null)[]> {
    const uniqueBits = [...new Set(bits.filter((bit) => bit > 0))];
    if (uniqueBits.length === 0) return bits.map(() => null);

    const rows = await this.db
      .select({ permissionId: permissions.permissionId, bitValue: permissions.bitValue })
      .from(permissions)
      .where(inArray(permissions.bitValue, uniqueBits));
    const idsByBit = new Map(
      rows.map((row) => [Number(row.bitValue), row.permissionId]),
    );

    return bits.map((bit) => (bit > 0 ? idsByBit.get(bit) ?? null : null));
  }

  private async replaceRoleGroupMappings(
    tx: PostgresDatabase,
    boardId: number,
    roleGroupIds: number[],
  ): Promise<void> {
    await tx.delete(boardRoleGroups).where(eq(boardRoleGroups.boardId, boardId));

    const uniqueRoleGroupIds = [...new Set(roleGroupIds)].filter(
      (roleGroupId) => roleGroupId > 0,
    );
    if (uniqueRoleGroupIds.length === 0) return;

    const existingRoleGroups = await tx
      .select({ roleGroupId: roleGroups.roleGroupId })
      .from(roleGroups)
      .where(inArray(roleGroups.roleGroupId, uniqueRoleGroupIds));
    if (existingRoleGroups.length !== uniqueRoleGroupIds.length) {
      throw new BadRequestException("invalid_board_role_group");
    }

    await tx.insert(boardRoleGroups).values(
      uniqueRoleGroupIds.map((roleGroupId) => ({ boardId, roleGroupId })),
    );
  }

  async create(input: BoardCreateRequest): Promise<BoardSummary> {
    const isLegacyPermissionMode =
      input.writeRoleGroupIds.length === 0 &&
      input.writeAccessType === "PERMISSION" &&
      input.writePermissionBit > 0;
    const [writePermissionId] = await this.resolvePermissionIds([
      isLegacyPermissionMode ? input.writePermissionBit : 0,
    ]);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(boards)
        .values({
          code: input.code,
          nameKo: input.nameKo,
          nameEn: input.nameEn ?? null,
          descriptionKo: input.descriptionKo ?? null,
          descriptionEn: input.descriptionEn ?? null,
          writeAccessType: isLegacyPermissionMode
            ? "PERMISSION"
            : "ROLE_GROUP",
          writePermissionId: isLegacyPermissionMode ? writePermissionId : null,
          allowComment: input.allowComment,
          allowOfficialReply: input.allowOfficialReply,
          allowSecret: input.allowSecret,
          allowLike: input.allowLike,
          sortOrder: input.sortOrder,
          isActive: true,
        })
        .returning();

      if (row) {
        await this.replaceRoleGroupMappings(tx, row.boardId, input.writeRoleGroupIds);
      }
      return row;
    });

    const [result] = await this.resolveBoardWithPermissions(created ? [created] : []);
    return result;
  }

  async update(code: string, input: BoardUpdateRequest): Promise<BoardSummary | null> {
    const current = await this.db.query.boards.findFirst({
      where: eq(boards.code, code),
    });
    if (!current) return null;

    const set: Partial<typeof boards.$inferInsert> = {};

    if (input.nameKo !== undefined) set.nameKo = input.nameKo;
    if (input.nameEn !== undefined) set.nameEn = input.nameEn;
    if (input.descriptionKo !== undefined) set.descriptionKo = input.descriptionKo;
    if (input.descriptionEn !== undefined) set.descriptionEn = input.descriptionEn;
    if (input.allowComment !== undefined) set.allowComment = input.allowComment;
    if (input.allowOfficialReply !== undefined) {
      set.allowOfficialReply = input.allowOfficialReply;
    }
    if (input.allowSecret !== undefined) set.allowSecret = input.allowSecret;
    if (input.allowLike !== undefined) set.allowLike = input.allowLike;
    if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) set.isActive = input.isActive;

    const hasRoleMappingUpdate = input.writeRoleGroupIds !== undefined;
    const hasLegacyWriteUpdate =
      !hasRoleMappingUpdate &&
      (input.writePermissionBit !== undefined || input.writeAccessType !== undefined);

    if (hasRoleMappingUpdate) {
      set.writeAccessType = "ROLE_GROUP";
      set.writePermissionId = null;
    } else if (hasLegacyWriteUpdate) {
      const writeAccessType = input.writeAccessType ?? current.writeAccessType;
      const [legacyPermissionId] = await this.resolvePermissionIds([
        writeAccessType === "PERMISSION"
          ? input.writePermissionBit ?? 0
          : 0,
      ]);
      set.writeAccessType = writeAccessType;
      set.writePermissionId = legacyPermissionId;
    }

    if (Object.keys(set).length === 0 && !hasRoleMappingUpdate) {
      return this.findByCode(code);
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(boards)
        .set(set)
        .where(eq(boards.code, code))
        .returning();

      if (row && hasRoleMappingUpdate) {
        await this.replaceRoleGroupMappings(tx, row.boardId, input.writeRoleGroupIds ?? []);
      }
      return row;
    });

    if (!updated) return null;
    const [result] = await this.resolveBoardWithPermissions([updated]);
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
