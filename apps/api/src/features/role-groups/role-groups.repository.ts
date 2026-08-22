import { Inject, Injectable } from "@nestjs/common";

import { and, asc, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";

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
  RoleGroupCandidateListResponse,
  RoleGroupMemberFilterRequest,
  UpdateRoleGroupRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

@Injectable()
export class RoleGroupsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private normalizePermissionIds(permissionIds: number[]): number[] {
    return [...new Set(permissionIds)].filter((permissionId) => permissionId > 0);
  }

  private mapAdminUser(row: typeof users.$inferSelect): AdminUserRecord {
    return {
      academicStatus: row.academicStatus ?? null,
      createdAt: msToIso(row.createdAt.valueOf()),
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      primaryMajor: row.primaryMajor ?? null,
      doubleMajor: row.doubleMajor ?? null,
      minor: row.minor ?? null,
      gender: row.gender ?? null,
      phoneNumber: row.phoneNumber ?? null,
      privacyConsentAt: row.privacyConsentAt
        ? msToIso(row.privacyConsentAt.valueOf())
        : null,
      email: row.email,
      identityCode: row.identityCode ?? null,
      isActive: row.isActive,
      kaistUid: row.kaistUid,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      nameEn: row.nameEn ?? null,
      nameKo: row.nameKo,
      stdNo: row.stdNo ?? null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      userId: String(row.userId),
    };
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
        createdAt: roleGroups.createdAt,
        description: roleGroups.description,
        isSystem: roleGroups.isSystem,
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
      .orderBy(asc(roleGroups.roleGroupId), asc(permissions.bitValue));

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
          createdAt: msToIso(row.createdAt.valueOf()),
          description: row.description,
          isSystem: row.isSystem,
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
      left.roleGroupId - right.roleGroupId,
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
          description: input.description ?? null,
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
          description: input.description ?? null,
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

  async listRoleGroupCandidates(
    roleGroupId: number,
    input: RoleGroupMemberFilterRequest,
  ): Promise<RoleGroupCandidateListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const query = input.q?.trim();
    const conditions = [
      query
        ? or(
            ilike(users.nameKo, `%${query}%`),
            ilike(users.nameEn, `%${query}%`),
            ilike(users.stdNo, `%${query}%`),
            ilike(users.email, `%${query}%`),
            ilike(users.departmentKo, `%${query}%`),
          )
        : undefined,
      input.department?.trim()
        ? or(
            ilike(users.departmentKo, `%${input.department.trim()}%`),
            ilike(users.departmentEn, `%${input.department.trim()}%`),
          )
        : undefined,
      input.academicStatus?.trim()
        ? ilike(users.academicStatus, `%${input.academicStatus.trim()}%`)
        : undefined,
      input.status === "active"
        ? eq(users.isActive, true)
        : input.status === "inactive"
          ? eq(users.isActive, false)
          : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          user: users,
          isMember: sql<boolean>`CASE WHEN ${userRoleGroups.userRoleGroupId} IS NULL THEN false ELSE true END`,
        })
        .from(users)
        .leftJoin(
          userRoleGroups,
          and(
            eq(userRoleGroups.userId, users.userId),
            eq(userRoleGroups.roleGroupId, roleGroupId),
            eq(userRoleGroups.isActive, true),
          ),
        )
        .where(whereClause)
        .orderBy(asc(users.nameKo), asc(users.kaistUid))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(whereClause),
    ]);

    return {
      items: rows.map((row) => ({
        ...this.mapAdminUser(row.user),
        isMember: Boolean(row.isMember),
      })),
      page,
      pageSize,
      total: Number(countRows[0]?.count ?? 0),
    };
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

  async replaceRoleGroupMembers(
    roleGroupId: number,
    userIds: string[],
    grantedBy?: string | null,
  ): Promise<RoleGroupMemberRecord[] | null> {
    const uniqueUserIds = [...new Set(userIds)];
    const valid = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(
        uniqueUserIds.length > 0
          ? inArray(users.userId, uniqueUserIds)
          : sql`false`,
      );

    if (valid.length !== uniqueUserIds.length) {
      return null;
    }

    const now = nowDate();
    await this.db.transaction(async (tx) => {
      const activeMembers = await tx
        .select({ userId: userRoleGroups.userId })
        .from(userRoleGroups)
        .where(
          and(
            eq(userRoleGroups.roleGroupId, roleGroupId),
            eq(userRoleGroups.isActive, true),
          ),
        );
      const activeIds = new Set(activeMembers.map((member) => member.userId));

      const deactivateWhere = [
        eq(userRoleGroups.roleGroupId, roleGroupId),
        eq(userRoleGroups.isActive, true),
        ...(uniqueUserIds.length > 0
          ? [notInArray(userRoleGroups.userId, uniqueUserIds)]
          : []),
      ];
      await tx
        .update(userRoleGroups)
        .set({ isActive: false, validTo: now })
        .where(and(...deactivateWhere));

      const toInsert = uniqueUserIds.filter((userId) => !activeIds.has(userId));
      if (toInsert.length > 0) {
        await tx.insert(userRoleGroups).values(
          toInsert.map((userId) => ({
            grantedAt: now,
            grantedBy: grantedBy ?? null,
            isActive: true,
            roleGroupId,
            userId,
            validFrom: now,
            validTo: null,
          })),
        );
      }
    });

    return this.listRoleGroupMembers(roleGroupId);
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
