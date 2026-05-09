import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  permissions,
  roleGroupPermissions,
  userRoleGroups,
  users,
} from "../../../infrastructure/postgres/postgres.schema";

import type { UserRecord } from "../entities/user";

type UserUpsertInput = {
  academicStatus?: string | null;
  kaistUid: string;
  lastLoginAt?: Date;
  nameEn?: string | null;
  nameKo: string;
  ssoSubject: string;
  stdNo?: string | null;
  departmentEn?: string | null;
  departmentKo?: string | null;
  email: string;
  identityCode?: string | null;
  isActive?: boolean;
};

type UserProfileUpdateInput = {
  academicStatus?: string | null;
  departmentEn?: string | null;
  departmentKo?: string | null;
  email?: string;
  identityCode?: string | null;
  lastLoginAt?: Date;
  nameEn?: string | null;
  nameKo?: string;
  stdNo?: string | null;
};

/**
 * PostgreSQL users 테이블 접근 로직입니다.
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  /** DB row를 서비스 계층에서 사용하는 UserRecord로 변환합니다. */
  private mapRowToUserRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      createdAt: row.createdAt.toISOString(),
      id: String(row.userId),
      kaistUid: row.kaistUid,
      nameEn: row.nameEn,
      nameKo: row.nameKo,
      ssoSubject: row.ssoSubject,
      stdNo: row.stdNo ?? null,
      email: row.email,
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      academicStatus: row.academicStatus ?? null,
      identityCode: row.identityCode ?? null,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** KAIST UID로 users 레코드를 조회합니다. */
  async findByKaistUid(kaistUid: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.kaistUid, kaistUid),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 내부 사용자 ID로 users 레코드를 조회합니다. */
  async findById(userId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.userId, Number(userId)),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 신규 users 레코드를 생성하고 생성 결과를 반환합니다. */
  async insert(input: UserUpsertInput): Promise<UserRecord> {
    const inserted = await this.db
      .insert(users)
      .values({
        academicStatus: input.academicStatus ?? null,
        kaistUid: input.kaistUid,
        lastLoginAt: input.lastLoginAt ?? new Date(),
        nameEn: input.nameEn ?? null,
        nameKo: input.nameKo,
        ssoSubject: input.ssoSubject,
        stdNo: input.stdNo ?? null,
        departmentEn: input.departmentEn ?? null,
        departmentKo: input.departmentKo ?? null,
        email: input.email,
        identityCode: input.identityCode ?? null,
        isActive: input.isActive ?? true,
      })
      .returning();

    return this.mapRowToUserRecord(inserted[0]);
  }

  /** KAIST UID 기준으로 사용자 정보를 생성/갱신합니다. */
  async upsertByKaistUid(input: UserUpsertInput): Promise<UserRecord> {
    const insertValues: typeof users.$inferInsert = {
      kaistUid: input.kaistUid,
      ssoSubject: input.ssoSubject,
      nameKo: input.nameKo,
      email: input.email,
      lastLoginAt: input.lastLoginAt ?? new Date(),
      isActive: input.isActive ?? true,
      nameEn: input.nameEn ?? null,
      stdNo: input.stdNo ?? null,
      departmentKo: input.departmentKo ?? null,
      departmentEn: input.departmentEn ?? null,
      academicStatus: input.academicStatus ?? null,
      identityCode: input.identityCode ?? null,
    };

    const updateSet: typeof users.$inferInsert = {
      email: input.email,
      isActive: input.isActive ?? true,
      kaistUid: input.kaistUid,
      lastLoginAt: input.lastLoginAt ?? new Date(),
      nameKo: input.nameKo,
      ssoSubject: input.ssoSubject,
      updatedAt: new Date(),
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.stdNo !== undefined ? { stdNo: input.stdNo } : {}),
      ...(input.departmentKo !== undefined
        ? { departmentKo: input.departmentKo }
        : {}),
      ...(input.departmentEn !== undefined
        ? { departmentEn: input.departmentEn }
        : {}),
      ...(input.academicStatus !== undefined
        ? { academicStatus: input.academicStatus }
        : {}),
      ...(input.identityCode !== undefined
        ? { identityCode: input.identityCode }
        : {}),
    };

    const upserted = await this.db
      .insert(users)
      .values(insertValues)
      .onConflictDoUpdate({
        target: users.kaistUid,
        set: updateSet,
      })
      .returning();

    return this.mapRowToUserRecord(upserted[0]);
  }

  /** 이름/이메일을 선택적으로 갱신합니다. */
  async updateProfile(
    userId: string,
    input: UserProfileUpdateInput,
  ): Promise<void> {
    const updateSet: {
      academicStatus?: string | null;
      departmentEn?: string | null;
      departmentKo?: string | null;
      updatedAt: Date;
      email?: string;
      identityCode?: string | null;
      lastLoginAt?: Date;
      nameEn?: string | null;
      nameKo?: string;
      stdNo?: string | null;
    } = {
      updatedAt: new Date(),
    };

    if (input.nameKo !== undefined) {
      updateSet.nameKo = input.nameKo;
    }

    if (input.nameEn !== undefined) {
      updateSet.nameEn = input.nameEn;
    }

    if (input.email !== undefined) {
      updateSet.email = input.email;
    }

    if (input.stdNo !== undefined) {
      updateSet.stdNo = input.stdNo;
    }

    if (input.departmentKo !== undefined) {
      updateSet.departmentKo = input.departmentKo;
    }

    if (input.departmentEn !== undefined) {
      updateSet.departmentEn = input.departmentEn;
    }

    if (input.academicStatus !== undefined) {
      updateSet.academicStatus = input.academicStatus;
    }

    if (input.identityCode !== undefined) {
      updateSet.identityCode = input.identityCode;
    }

    if (input.lastLoginAt !== undefined) {
      updateSet.lastLoginAt = input.lastLoginAt;
    }

    await this.db.update(users).set(updateSet).where(eq(users.userId, Number(userId)));
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    const now = new Date();
    const rows = await this.db
      .select({
        permissionBits: sql<number>`COALESCE(SUM(${permissions.bitValue}), 0)`,
      })
      .from(userRoleGroups)
      .innerJoin(
        roleGroupPermissions,
        eq(userRoleGroups.roleGroupId, roleGroupPermissions.roleGroupId),
      )
      .innerJoin(
        permissions,
        eq(roleGroupPermissions.permissionId, permissions.permissionId),
      )
      .where(
        and(
          eq(userRoleGroups.userId, Number(userId)),
          eq(userRoleGroups.isActive, true),
          eq(permissions.isActive, true),
          or(isNull(userRoleGroups.validFrom), lte(userRoleGroups.validFrom, now)),
          or(isNull(userRoleGroups.validTo), gte(userRoleGroups.validTo, now)),
        ),
      );

    return Number(rows[0]?.permissionBits ?? 0);
  }
}
