import { Inject, Injectable } from "@nestjs/common";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  permissions,
  roleGroupPermissions,
  roleGroups,
  userRoleGroups,
  users,
} from "../../infrastructure/postgres/postgres.schema";

import type {
  AdminUserRecord,
  AssignRoleGroupMemberRequest,
  CreateRoleGroupRequest,
  PermissionRecord,
  RoleGroupRecord,
  RoleGroupMemberRecord,
  UpdateRoleGroupRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

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
          createdAt: msToIso(row.createdAt.valueOf()),
          description: row.description,
          isSystem: row.isSystem,
          nameEn: row.nameEn,
          nameKo: row.nameKo,
          permissionIds: [],
          permissionMask: 0,
          roleGroupId: row.roleGroupId,
          updatedAt: msToIso(row.updatedAt.valueOf()),
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
    const now = nowDate();
    await this.db.transaction(async (tx) => {
      await tx
        .update(roleGroups)
        .set({
          code: input.code,
          description: input.description ?? null,
          nameEn: input.nameEn ?? null,
          nameKo: input.nameKo,
          updatedAt: now,
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

  async listRoleGroupMembers(roleGroupId: number): Promise<RoleGroupMemberRecord[]> {
    const rows = await this.db
      .select({
        academicStatus: users.academicStatus,
        createdAt: users.createdAt,
        departmentEn: users.departmentEn,
        departmentKo: users.departmentKo,
        email: users.email,
        grantedAt: userRoleGroups.grantedAt,
        grantedBy: userRoleGroups.grantedBy,
        identityCode: users.identityCode,
        isActive: users.isActive,
        kaistUid: users.kaistUid,
        lastLoginAt: users.lastLoginAt,
        membershipActive: userRoleGroups.isActive,
        nameEn: users.nameEn,
        nameKo: users.nameKo,
        roleGroupId: userRoleGroups.roleGroupId,
        stdNo: users.stdNo,
        updatedAt: users.updatedAt,
        userId: users.userId,
        userRoleGroupId: userRoleGroups.userRoleGroupId,
        validFrom: userRoleGroups.validFrom,
        validTo: userRoleGroups.validTo,
      })
      .from(userRoleGroups)
      .innerJoin(users, eq(userRoleGroups.userId, users.userId))
      .where(and(eq(userRoleGroups.roleGroupId, roleGroupId), eq(userRoleGroups.isActive, true)))
      .orderBy(asc(users.nameKo), asc(users.kaistUid));

    return rows.map((row) => ({
      academicStatus: row.academicStatus ?? null,
      createdAt: msToIso(row.createdAt.valueOf()),
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      email: row.email,
      grantedAt: msToIso(row.grantedAt.valueOf()),
      grantedBy: row.grantedBy ?? null,
      identityCode: row.identityCode ?? null,
      isActive: row.isActive,
      kaistUid: row.kaistUid,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      membershipActive: row.membershipActive,
      nameEn: row.nameEn ?? null,
      nameKo: row.nameKo,
      roleGroupId: row.roleGroupId,
      stdNo: row.stdNo ?? null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      userId: row.userId,
      userRoleGroupId: row.userRoleGroupId,
      validFrom: row.validFrom ? msToIso(row.validFrom.valueOf()) : null,
      validTo: row.validTo ? msToIso(row.validTo.valueOf()) : null,
    }));
  }

  async addUserToRoleGroup(
    roleGroupId: number,
    input: AssignRoleGroupMemberRequest & { grantedBy?: string | null },
  ): Promise<RoleGroupMemberRecord | null> {
    const now = nowDate();

    await this.db.transaction(async (tx) => {
      await tx
        .update(userRoleGroups)
        .set({
          isActive: false,
          validTo: now,
        })
        .where(
          and(
            eq(userRoleGroups.roleGroupId, roleGroupId),
            eq(userRoleGroups.userId, input.userId),
            eq(userRoleGroups.isActive, true),
          ),
        );

      await tx.insert(userRoleGroups).values({
        grantedAt: now,
        grantedBy: input.grantedBy ?? null,
        isActive: true,
        roleGroupId,
        userId: input.userId,
        validFrom: now,
        validTo: null,
      });
    });

    const members = await this.listRoleGroupMembers(roleGroupId);
    return members.find((member) => member.userId === input.userId) ?? null;
  }

  async removeUserFromRoleGroup(roleGroupId: number, userId: string): Promise<void> {
    const now = nowDate();

    await this.db
      .update(userRoleGroups)
      .set({
        isActive: false,
        validTo: now,
      })
      .where(
        and(
          eq(userRoleGroups.roleGroupId, roleGroupId),
          eq(userRoleGroups.userId, userId),
          eq(userRoleGroups.isActive, true),
        ),
      );
  }
}