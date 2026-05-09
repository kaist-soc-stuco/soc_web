import { Inject, Injectable } from "@nestjs/common";

import { asc, eq, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  permissions,
  roleGroupPermissions,
  roleGroups,
  userRoleGroups,
} from "../../infrastructure/postgres/postgres.schema";

import type {
  CreateRoleGroupRequest,
  PermissionRecord,
  RoleGroupRecord,
  UpdateRoleGroupRequest,
} from "@soc/contracts";

@Injectable()
export class RoleGroupsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private normalizePermissionIds(permissionIds: number[]): number[] {
    return [...new Set(permissionIds)].filter((permissionId) => permissionId > 0);
  }

  private async setRoleGroupPermissions(
    tx: PostgresDatabase,
    roleGroupId: number,
    permissionIds: number[],
  ): Promise<void> {
    await tx
      .delete(roleGroupPermissions)
      .where(eq(roleGroupPermissions.roleGroupId, roleGroupId));

    const normalizedPermissionIds = this.normalizePermissionIds(permissionIds);

    if (normalizedPermissionIds.length === 0) {
      return;
    }

    await tx.insert(roleGroupPermissions).values(
      normalizedPermissionIds.map((permissionId) => ({
        permissionId,
        roleGroupId,
      })),
    );
  }

  async listPermissions(): Promise<PermissionRecord[]> {
    const rows = await this.db
      .select()
      .from(permissions)
      .orderBy(asc(permissions.bitValue));

    return rows.map((row) => ({
      bitValue: Number(row.bitValue),
      code: row.code,
      description: row.description ?? null,
      isActive: row.isActive,
      nameEn: row.nameEn ?? null,
      nameKo: row.nameKo,
      permissionId: row.permissionId,
    }));
  }

  async listRoleGroups(): Promise<RoleGroupRecord[]> {
    const rows = await this.db
      .select({
        code: roleGroups.code,
        createdAt: roleGroups.createdAt,
        description: roleGroups.description,
        isSystem: roleGroups.isSystem,
        nameEn: roleGroups.nameEn,
        nameKo: roleGroups.nameKo,
        permissionBitValue: permissions.bitValue,
        permissionId: permissions.permissionId,
        roleGroupId: roleGroups.roleGroupId,
        updatedAt: roleGroups.updatedAt,
      })
      .from(roleGroups)
      .leftJoin(
        roleGroupPermissions,
        eq(roleGroups.roleGroupId, roleGroupPermissions.roleGroupId),
      )
      .leftJoin(permissions, eq(roleGroupPermissions.permissionId, permissions.permissionId))
      .orderBy(asc(roleGroups.code), asc(permissions.bitValue));

    const userCountRows = await this.db
      .select({
        roleGroupId: userRoleGroups.roleGroupId,
        userCount: sql<number>`COUNT(*)`,
      })
      .from(userRoleGroups)
      .where(eq(userRoleGroups.isActive, true))
      .groupBy(userRoleGroups.roleGroupId);

    const userCountByRoleGroupId = new Map<number, number>(
      userCountRows.map((row) => [row.roleGroupId, Number(row.userCount ?? 0)]),
    );

    const grouped = new Map<number, RoleGroupRecord>();

    for (const row of rows) {
      if (!grouped.has(row.roleGroupId)) {
        grouped.set(row.roleGroupId, {
          code: row.code,
          createdAt: row.createdAt.toISOString(),
          description: row.description,
          isSystem: row.isSystem,
          nameEn: row.nameEn,
          nameKo: row.nameKo,
          permissionIds: [],
          permissionMask: 0,
          roleGroupId: row.roleGroupId,
          updatedAt: row.updatedAt.toISOString(),
          userCount: userCountByRoleGroupId.get(row.roleGroupId) ?? 0,
        });
      }

      if (row.permissionId && row.permissionBitValue) {
        const current = grouped.get(row.roleGroupId);
        if (current) {
          current.permissionIds.push(row.permissionId);
          current.permissionMask += Number(row.permissionBitValue);
        }
      }
    }

    return [...grouped.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    );
  }

  async findRoleGroupById(roleGroupId: number): Promise<RoleGroupRecord | null> {
    const items = await this.listRoleGroups();
    return items.find((item) => item.roleGroupId === roleGroupId) ?? null;
  }

  async createRoleGroup(input: CreateRoleGroupRequest): Promise<RoleGroupRecord | null> {
    const createdRoleGroupId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(roleGroups)
        .values({
          code: input.code,
          description: input.description ?? null,
          nameEn: input.nameEn ?? null,
          nameKo: input.nameKo,
        })
        .returning({ roleGroupId: roleGroups.roleGroupId });

      if (!row) {
        return null;
      }

      await this.setRoleGroupPermissions(tx, row.roleGroupId, input.permissionIds);
      return row.roleGroupId;
    });

    if (!createdRoleGroupId) {
      return null;
    }

    return this.findRoleGroupById(createdRoleGroupId);
  }

  async updateRoleGroup(
    roleGroupId: number,
    input: UpdateRoleGroupRequest,
  ): Promise<RoleGroupRecord | null> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(roleGroups)
        .set({
          code: input.code,
          description: input.description ?? null,
          nameEn: input.nameEn ?? null,
          nameKo: input.nameKo,
          updatedAt: new Date(),
        })
        .where(eq(roleGroups.roleGroupId, roleGroupId));

      await this.setRoleGroupPermissions(tx, roleGroupId, input.permissionIds);
    });

    return this.findRoleGroupById(roleGroupId);
  }

  async deleteRoleGroup(roleGroupId: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(userRoleGroups).where(eq(userRoleGroups.roleGroupId, roleGroupId));
      await tx
        .delete(roleGroupPermissions)
        .where(eq(roleGroupPermissions.roleGroupId, roleGroupId));
      await tx.delete(roleGroups).where(eq(roleGroups.roleGroupId, roleGroupId));
    });
  }
}