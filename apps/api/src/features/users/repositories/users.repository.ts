import { Inject, Injectable } from "@nestjs/common";

import { msToIso, nowDate } from "@soc/shared";
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  permissions,
  roleGroupPermissions,
  studentFeeStatus,
  userRoleGroups,
  users,
} from "../../../infrastructure/postgres/postgres.schema";

import type { UserRecord } from "../entities/user";
import type { AdminUserRecord, StudentFeeStatusRecord, FeeStatus } from "@soc/contracts";

type UserUpsertInput = {
  academicStatus?: string | null;
  kaistUid: string;
  nameEn?: string | null;
  nameKo: string;
  stdNo?: string | null;
  departmentEn?: string | null;
  departmentKo?: string | null;
  email: string;
  identityCode?: string | null;
  isActive?: boolean;
  privacyConsentAt?: Date | null;
  lastLoginAt?: Date;
};

type UserProfileUpdateInput = {
  academicStatus?: string | null;
  departmentEn?: string | null;
  departmentKo?: string | null;
  email?: string;
  identityCode?: string | null;
  nameEn?: string | null;
  nameKo?: string;
  stdNo?: string | null;
  lastLoginAt?: Date;
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
      createdAt: msToIso(row.createdAt.valueOf()),
      userId: String(row.userId),
      kaistUid: row.kaistUid,
      nameEn: row.nameEn,
      nameKo: row.nameKo,
      stdNo: row.stdNo ?? null,
      email: row.email,
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      academicStatus: row.academicStatus ?? null,
      identityCode: row.identityCode ?? null,
      privacyConsentAt: row.privacyConsentAt ? msToIso(row.privacyConsentAt.valueOf()) : null,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
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
      where: eq(users.userId, userId),
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
        lastLoginAt: input.lastLoginAt ?? nowDate(),
        nameEn: input.nameEn ?? null,
        nameKo: input.nameKo,
        stdNo: input.stdNo ?? null,
        departmentEn: input.departmentEn ?? null,
        departmentKo: input.departmentKo ?? null,
        email: input.email,
        identityCode: input.identityCode ?? null,
        isActive: input.isActive ?? true,
        privacyConsentAt: input.privacyConsentAt ?? null,
      })
      .returning();

    return this.mapRowToUserRecord(inserted[0]);
  }

  /** KAIST UID 기준으로 사용자 정보를 생성/갱신합니다. */
  async upsertByKaistUid(input: UserUpsertInput): Promise<UserRecord> {
    const now = nowDate();
    const insertValues: typeof users.$inferInsert = {
      kaistUid: input.kaistUid,
      nameKo: input.nameKo,
      email: input.email,
      lastLoginAt: input.lastLoginAt ?? now,
      isActive: input.isActive ?? true,
      nameEn: input.nameEn ?? null,
      stdNo: input.stdNo ?? null,
      departmentKo: input.departmentKo ?? null,
      departmentEn: input.departmentEn ?? null,
      academicStatus: input.academicStatus ?? null,
      identityCode: input.identityCode ?? null,
      privacyConsentAt: input.privacyConsentAt ?? null,
    };

    const updateSet: typeof users.$inferInsert = {
      email: input.email,
      isActive: input.isActive ?? true,
      kaistUid: input.kaistUid,
      lastLoginAt: input.lastLoginAt ?? now,
      nameKo: input.nameKo,
      updatedAt: now,
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
      ...(input.privacyConsentAt !== undefined
        ? { privacyConsentAt: input.privacyConsentAt }
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

  /** 개인정보 영구 저장 동의 시각을 기록합니다. */
  // async markConsent(userId: string, consentedAt: string): Promise<void> {
  //   await this.db
  //     .update(users)
  //     .set({
  //       privacyConsentAt: isoToDate(consentedAt),
  //       updatedAt: nowDate(),
  //     })
  //     .where(eq(users.userId, Number(userId)));
  // }

  /** 이메일/휴대전화 필드만 선택적으로 갱신합니다. */
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
      updatedAt: nowDate(),
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

    await this.db.update(users).set(updateSet).where(eq(users.userId, userId));
  }

  async searchUsers(query: string | undefined, limit = 20): Promise<AdminUserRecord[]> {
    const normalizedQuery = query?.trim() ?? "";
    const whereClause = normalizedQuery
      ? or(
          ilike(users.nameKo, `%${normalizedQuery}%`),
          ilike(users.nameEn, `%${normalizedQuery}%`),
          ilike(users.kaistUid, `%${normalizedQuery}%`),
          ilike(users.email, `%${normalizedQuery}%`),
          ilike(users.stdNo, `%${normalizedQuery}%`),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.updatedAt))
      .limit(Math.min(Math.max(limit, 1), 50));

    return rows.map((row) => ({
      createdAt: msToIso(row.createdAt.valueOf()),
      userId: row.userId,
      kaistUid: row.kaistUid,
      nameEn: row.nameEn ?? null,
      nameKo: row.nameKo,
      stdNo: row.stdNo ?? null,
      email: row.email,
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      academicStatus: row.academicStatus ?? null,
      identityCode: row.identityCode ?? null,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    }));
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    const now = nowDate();
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
          eq(userRoleGroups.userId, userId),
          eq(userRoleGroups.isActive, true),
          eq(permissions.isActive, true),
          or(isNull(userRoleGroups.validFrom), lte(userRoleGroups.validFrom, now)),
          or(isNull(userRoleGroups.validTo), gte(userRoleGroups.validTo, now)),
        ),
      );

    return Number(rows[0]?.permissionBits ?? 0);
  }

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    const found = await this.db
      .select()
      .from(studentFeeStatus)
      .where(eq(studentFeeStatus.userId, userId))
      .limit(1);

    if (!found.length) return null;

    const row = found[0];
    const normalizedStatus: FeeStatus = row.status === "PAID" || row.status === "WAIVED" ? row.status : "UNPAID";

    return {
      userId: row.userId,
      status: normalizedStatus,
      coverageSemesters: row.coverageSemesters,
      paidAt: row.paidAt ? msToIso(row.paidAt.valueOf()) : null,
      verifiedBy: row.verifiedBy,
      verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
      note: row.note,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async updateStudentFeeStatus(
    userId: string,
    input: {
      status: FeeStatus;
      coverageSemesters?: number;
      note?: string | null;
      verifiedBy?: number;
    },
  ): Promise<StudentFeeStatusRecord> {
    // 존재하지 않으면 기본 행을 먼저 생성하여 update가 동작하도록 보장합니다.
    await this.ensureStudentFeeStatus(userId);

    const now = nowDate();
    const updateSet: any = {
      status: input.status,
      updatedAt: now,
    };

    if (input.coverageSemesters !== undefined) {
      updateSet.coverageSemesters = input.coverageSemesters;
    }
    if (input.note !== undefined) {
      updateSet.note = input.note;
    }
    if (input.verifiedBy !== undefined) {
      updateSet.verifiedBy = input.verifiedBy;
      updateSet.verifiedAt = now;
    }
    if (input.status === "PAID") {
      updateSet.paidAt = now;
    } else {
      updateSet.paidAt = null;
    }

    await this.db
      .update(studentFeeStatus)
      .set(updateSet)
      .where(eq(studentFeeStatus.userId, userId));

    return this.getStudentFeeStatus(userId) as Promise<StudentFeeStatusRecord>;
  }

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    const existing = await this.getStudentFeeStatus(userId);
    if (existing) return existing;

    // 존재하지 않으면 생성 (기본값: UNPAID)
    const now = nowDate();
    await this.db
      .insert(studentFeeStatus)
      .values({
        userId,
        status: "UNPAID",
        coverageSemesters: 4,
        updatedAt: now,
      })
      .onConflictDoNothing();

    return this.getStudentFeeStatus(userId) as Promise<StudentFeeStatusRecord>;
  }

  async listStudentsByFeeStatus(
    status?: FeeStatus,
    page = 1,
    pageSize = 20,
  ): Promise<{ students: any[]; total: number; page: number; pageSize: number }> {
    const offset = (page - 1) * pageSize;

    const where = status
      ? status === "UNPAID"
        ? or(
            eq(studentFeeStatus.status, "UNPAID"),
            isNull(studentFeeStatus.status),
          )
        : eq(studentFeeStatus.status, status)
      : undefined;

    const rows = await this.db
      .select({
        userId: users.userId,
        nameKo: users.nameKo,
        nameEn: users.nameEn,
        stdNo: users.stdNo,
        email: users.email,
        status: studentFeeStatus.status,
        paidAt: studentFeeStatus.paidAt,
        verifiedAt: studentFeeStatus.verifiedAt,
        note: studentFeeStatus.note,
      })
      .from(users)
      .leftJoin(studentFeeStatus, eq(users.userId, studentFeeStatus.userId))
      .where(where)
      .orderBy(desc(studentFeeStatus.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .leftJoin(studentFeeStatus, eq(users.userId, studentFeeStatus.userId))
      .where(where);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      students: rows.map((r) => ({
        status:
          r.status === "PAID" || r.status === "WAIVED"
            ? r.status
            : "UNPAID",
        userId: r.userId,
        nameKo: r.nameKo,
        nameEn: r.nameEn ?? null,
        stdNo: r.stdNo ?? null,
        email: r.email,
        paidAt: r.paidAt ? msToIso(r.paidAt.valueOf()) : null,
        verifiedAt: r.verifiedAt ? msToIso(r.verifiedAt.valueOf()) : null,
        note: r.note,
      })),
      total,
      page,
      pageSize,
    };
  }
}
