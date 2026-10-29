import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_AUTHENTICATED_PERMISSION_BITS } from "@soc/contracts";
import Redis from "ioredis";

import { isoToDate, isoToMs, msToDate, msToIso, nowDate } from "@soc/shared";
import { and, asc, desc, eq, getTableColumns, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, notInArray, or, sql, type SQL } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { REDIS_CLIENT } from "../../../infrastructure/redis/redis.provider";
import {
  permissions,
  roleGroupPermissions,
  studentFeePaymentBatches,
  studentFeePayments,
  studentFeeStatus,
  paidStudentRecords,
  studentFeePolicies,
  userRoleGroups,
  users,
  articles,
  boards,
  comments,
  articleEngagements,
  surveyResponses,
  surveys,
  userSanctions,
} from "../../../infrastructure/postgres/postgres.schema";

import type { UserRecord } from "../entities/user";
import { hashStudentFeePaymentPayload } from "../fee-payment-idempotency";
import type { StudentFeeBootstrapRecord } from "../student-fee-bootstrap-loader";
import { INITIAL_FEE_ROSTER_NOTE, initialFeeRosterLinkAllowed, initialFeeRosterStatus } from "../student-fee-roster";
import type { PostgresTransaction } from "../../../infrastructure/postgres/postgres.provider";
import { effectiveFeeStatusSql } from "../fee-status";
import { readableArticleFilter } from "../../board/article-query-access";
import type {
  StudentFeePolicy,
  StudentFeeRosterRecord,
  StudentFeeRosterUpdate,
  AdminUserListResponse,
  AdminUserRecord,
  BulkUpdateStudentFeeStatusRequest,
  BulkProcessStudentFeePaymentsRequest,
  BulkProcessStudentFeePaymentsResponse,
  ArticleStatus,
  CommentStatus,
  FeeMajorCategory,
  FeeStatus,
  MyActivityItem,
  MyArticleItem,
  MyCommentItem,
  MyScrapItem,
  MySurveyResponseItem,
  ResponseStatus,
  StudentFeeListResponse,
  StudentFeeStatsResponse,
  StudentFeeStatsOptions,
  StudentFeeStatusRecord,
  StudentFeeDetailResponse,
  StudentFeePaymentRecord,
  FeePaymentMethod,
  FeePaymentType,
  VisibilityScope,
  UserPostingSuspensionResponse,
  UserSanctionRecord,
} from "@soc/contracts";

type UserUpsertInput = {
  academicStatus?: string | null;
  kaistUid: string;
  nameEn?: string | null;
  nameKo: string;
  stdNo?: string | null;
  departmentEn?: string | null;
  departmentKo?: string | null;
  primaryMajor?: string | null;
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
  primaryMajor?: string | null;
  email?: string;
  identityCode?: string | null;
  nameEn?: string | null;
  nameKo?: string;
  stdNo?: string | null;
  lastLoginAt?: Date;
};

export type StudentFeeSortBy = "name" | "studentId" | "status" | "paidAt";
export type SortDirection = "asc" | "desc";
export type FeeReferenceSemester = string;

/**
 * Synthetic/system identities are useful for seeded content and QA, but they
 * must never appear in student fee or bulk-email audiences.
 *
 * Keep the legacy values here as well: a production database can contain an
 * older seed before the next seed run consolidates those users.
 */
export const EXCLUDED_SYSTEM_TARGET_KAIST_UIDS = [
  "demo-author",
  "reference-faq",
  "DEV0001",
  "seed-council-author",
] as const;
export type EmailRecipientFilters = {
  query?: string;
  studentNumber?: string;
  primaryMajor?: string;
  academicStatus?: string;
};
export type AdminUserSortBy =
  | "name"
  | "studentId"
  | "status"
  | "lastLoginAt"
  | "createdAt";

/**
 * PostgreSQL users 테이블 접근 로직입니다.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private buildPermissionCacheKey(userId: string): string {
    return `permission:bitmask:${userId}`;
  }

  private async cachePermissionBitmask(userId: string, permissionBits: number): Promise<void> {
    const ttlSeconds = this.configService.get<number>("REDIS_AUTH_TTL_SECONDS", 300);

    await this.redis.set(
      this.buildPermissionCacheKey(userId),
      String(permissionBits),
      "EX",
      ttlSeconds,
    );
  }

  async invalidatePermissionBitmask(userId: string): Promise<void> {
    await this.redis.del(this.buildPermissionCacheKey(userId));
  }

  async invalidatePermissionBitmasks(userIds: string[]): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)].filter((userId) => userId.trim().length > 0);

    if (uniqueUserIds.length === 0) {
      return;
    }

    await this.redis.del(...uniqueUserIds.map((userId) => this.buildPermissionCacheKey(userId)));
  }

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
      primaryMajor: row.primaryMajor ?? null,
      academicStatus: row.academicStatus ?? null,
      identityCode: row.identityCode ?? null,
      privacyConsentAt: row.privacyConsentAt ? msToIso(row.privacyConsentAt.valueOf()) : null,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private mapRowToAdminUserRecord(
    row: typeof users.$inferSelect,
  feeStatus?: FeeStatus,
  ): AdminUserRecord {
    return {
      academicStatus: row.academicStatus ?? null,
      createdAt: msToIso(row.createdAt.valueOf()),
      departmentEn: row.departmentEn ?? null,
      departmentKo: row.departmentKo ?? null,
      primaryMajor: row.primaryMajor ?? null,
      privacyConsentAt: row.privacyConsentAt
        ? msToIso(row.privacyConsentAt.valueOf())
        : null,
      ...(feeStatus ? { feeStatus } : {}),
      email: row.email,
      identityCode: row.identityCode ?? null,
      isActive: row.isActive,
      kaistUid: row.kaistUid,
      lastLoginAt: row.lastLoginAt ? msToIso(row.lastLoginAt.valueOf()) : null,
      nameEn: row.nameEn ?? null,
      nameKo: row.nameKo,
      stdNo: row.stdNo ?? null,
      updatedAt: msToIso(row.updatedAt.valueOf()),
      userId: row.userId,
    };
  }

  /** KAIST UID로 users 레코드를 조회합니다. */
  async findByKaistUid(kaistUid: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.kaistUid, kaistUid),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 이메일로 users 레코드를 조회합니다. */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.email, email),
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

  /** 스프레드시트 과비 이관에서 학번을 안정적인 사용자 식별자로 사용합니다. */
  async findByStdNo(stdNo: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.stdNo, stdNo),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 신규 users 레코드를 생성하고 생성 결과를 반환합니다. */
  async insert(input: UserUpsertInput): Promise<UserRecord> {
    const inserted = await this.db
      .insert(users)
      .values({
        academicStatus: null,
        kaistUid: input.kaistUid,
        lastLoginAt: input.lastLoginAt ?? nowDate(),
        nameEn: input.nameEn ?? null,
        nameKo: input.nameKo,
        stdNo: input.stdNo ?? null,
        departmentEn: input.departmentEn ?? null,
        departmentKo: input.departmentKo ?? null,
        primaryMajor: input.primaryMajor ?? null,
        gender: null,
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
    const updateSet: Partial<typeof users.$inferInsert> = {
      email: input.email,
      kaistUid: input.kaistUid,
      lastLoginAt: input.lastLoginAt ?? now,
      nameKo: input.nameKo,
      updatedAt: now,
      gender: null,
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.stdNo !== undefined ? { stdNo: input.stdNo } : {}),
      ...(input.departmentKo !== undefined
        ? { departmentKo: input.departmentKo }
        : {}),
      ...(input.departmentEn !== undefined
        ? { departmentEn: input.departmentEn }
        : {}),
      ...(input.primaryMajor !== undefined
        ? { primaryMajor: input.primaryMajor }
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

    return this.db.transaction(async (tx) => {
      const existingByKaistUid = await tx.query.users.findFirst({
        where: eq(users.kaistUid, input.kaistUid),
      });

      if (existingByKaistUid) {
        if (!existingByKaistUid.isActive) {
          throw new ForbiddenException("account_expired");
        }
        const [updated] = await tx
          .update(users)
          .set(updateSet)
          .where(eq(users.userId, existingByKaistUid.userId))
          .returning();

        return this.mapRowToUserRecord(updated);
      }

      const existingByEmail = await tx.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (existingByEmail) {
        if (!existingByEmail.isActive) {
          throw new ForbiddenException("account_expired");
        }
        const [updated] = await tx
          .update(users)
          .set(updateSet)
          .where(eq(users.userId, existingByEmail.userId))
          .returning();

        return this.mapRowToUserRecord(updated);
      }

      const [inserted] = await tx
        .insert(users)
        .values({
          kaistUid: input.kaistUid,
          nameKo: input.nameKo,
          email: input.email,
          lastLoginAt: input.lastLoginAt ?? now,
          isActive: input.isActive ?? true,
          nameEn: input.nameEn ?? null,
          stdNo: input.stdNo ?? null,
          departmentKo: input.departmentKo ?? null,
          primaryMajor: input.primaryMajor ?? null,
          gender: null,
          departmentEn: input.departmentEn ?? null,
          academicStatus: null,
          identityCode: input.identityCode ?? null,
          privacyConsentAt: input.privacyConsentAt ?? null,
        })
        .returning();

      return this.mapRowToUserRecord(inserted);
    });
  }

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
      primaryMajor?: string | null;
      gender: null;
      updatedAt: Date;
      email?: string;
      identityCode?: string | null;
      lastLoginAt?: Date;
      nameEn?: string | null;
      nameKo?: string;
      stdNo?: string | null;
    } = {
      updatedAt: nowDate(),
      gender: null,
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

    if (input.primaryMajor !== undefined) {
      updateSet.primaryMajor = input.primaryMajor;
    }

    if (input.academicStatus !== undefined) {
      updateSet.academicStatus = null;
    }

    if (input.identityCode !== undefined) {
      updateSet.identityCode = input.identityCode;
    }

    if (input.lastLoginAt !== undefined) {
      updateSet.lastLoginAt = input.lastLoginAt;
    }

    await this.db.update(users).set(updateSet).where(eq(users.userId, userId));
  }

  /** 계정 활성 상태를 변경하고 최신 사용자 레코드를 반환합니다. */
  async setActiveStatus(
    userId: string,
    isActive: boolean,
  ): Promise<UserRecord | null> {
    const [updated] = await this.db
      .update(users)
      .set({ isActive, updatedAt: nowDate() })
      .where(eq(users.userId, userId))
      .returning();

    if (!updated) return null;

    await this.invalidatePermissionBitmask(userId);
    return this.mapRowToUserRecord(updated);
  }

  private mapUserSanction(row: typeof userSanctions.$inferSelect): UserSanctionRecord {
    return {
      sanctionId: row.sanctionId,
      userId: String(row.userId),
      type: "POSTING_SUSPENDED",
      reason: row.reason,
      issuedBy: row.issuedBy ? String(row.issuedBy) : null,
      startsAt: msToIso(row.startsAt.valueOf()),
      expiresAt: row.expiresAt ? msToIso(row.expiresAt.valueOf()) : null,
      revokedAt: row.revokedAt ? msToIso(row.revokedAt.valueOf()) : null,
      revokedBy: row.revokedBy ? String(row.revokedBy) : null,
      createdAt: msToIso(row.createdAt.valueOf()),
    };
  }

  async getPostingSuspension(userId: string): Promise<UserSanctionRecord | null> {
    const now = nowDate();
    const rows = await this.db
      .select()
      .from(userSanctions)
      .where(
        and(
          eq(userSanctions.userId, userId),
          eq(userSanctions.type, "POSTING_SUSPENDED"),
          isNull(userSanctions.revokedAt),
          lte(userSanctions.startsAt, now),
          or(isNull(userSanctions.expiresAt), gt(userSanctions.expiresAt, now)),
        ),
      )
      .orderBy(desc(userSanctions.createdAt))
      .limit(1);

    return rows[0] ? this.mapUserSanction(rows[0]) : null;
  }

  async setPostingSuspension(input: {
    userId: string;
    suspended: boolean;
    reason?: string;
    issuedBy: string;
    expiresAt?: Date | null;
  }): Promise<UserSanctionRecord | null> {
    const now = nowDate();
    return this.db.transaction(async (tx) => {
      const activeWhere = and(
        eq(userSanctions.userId, input.userId),
        eq(userSanctions.type, "POSTING_SUSPENDED"),
        isNull(userSanctions.revokedAt),
      );

      if (!input.suspended) {
        await tx
          .update(userSanctions)
          .set({ revokedAt: now, revokedBy: input.issuedBy })
          .where(activeWhere);
        return null;
      }

      await tx
        .update(userSanctions)
        .set({ revokedAt: now, revokedBy: input.issuedBy })
        .where(activeWhere);

      const [created] = await tx
        .insert(userSanctions)
        .values({
          userId: input.userId,
          type: "POSTING_SUSPENDED",
          reason: input.reason?.trim() || "admin_manual",
          issuedBy: input.issuedBy,
          startsAt: now,
          expiresAt: input.expiresAt ?? null,
        })
        .returning();

      return created ? this.mapUserSanction(created) : null;
    });
  }

  async searchUsers(query: string | undefined, limit = 20): Promise<AdminUserRecord[]> {
    const normalizedQuery = query?.trim() ?? "";
    const whereClause = normalizedQuery
      ? or(
          ilike(users.nameKo, `%${normalizedQuery}%`),
          ilike(users.nameEn, `%${normalizedQuery}%`),
          ilike(users.stdNo, `%${normalizedQuery}%`),
          ilike(users.email, `%${normalizedQuery}%`),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.updatedAt))
      .limit(Math.min(Math.max(limit, 1), 50));

    return rows.map((row) => this.mapRowToAdminUserRecord(row));
  }

  async listEmailRecipients(
    recipientType: "ALL" | "PAID_STUDENTS" | "UNPAID_STUDENTS",
    filters?: EmailRecipientFilters,
  ): Promise<
    Array<{
      email: string;
      nameKo: string;
      studentNumber: string | null;
    }>
  > {
    const effectiveStatus = effectiveFeeStatusSql();
    const feeFilter =
      recipientType === "PAID_STUDENTS"
        ? eq(effectiveStatus, "PAID")
        : recipientType === "UNPAID_STUDENTS"
          ? eq(effectiveStatus, "UNPAID")
          : undefined;

    const conditions: SQL[] = [
      eq(users.isActive, true),
      notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS]),
    ];
    if (feeFilter) conditions.push(feeFilter);
    const filterValues = (value?: string) => [...new Set((value ?? "").split(",").map(part => part.trim()).filter(Boolean))];
    const queries = filterValues(filters?.query);
    if (queries.length) conditions.push(or(...queries.map(query => or(
      ilike(users.nameKo, `%${query}%`), ilike(users.nameEn, `%${query}%`),
      ilike(users.stdNo, `%${query}%`), ilike(users.email, `%${query}%`),
    )))!);
    const studentNumbers = filterValues(filters?.studentNumber);
    if (studentNumbers.length) conditions.push(or(...studentNumbers.map(value =>
      /^20\d{2}_OR_EARLIER$/.test(value) ? lt(users.stdNo, `${Number(value.slice(0, 4)) + 1}0000`) : ilike(users.stdNo, `${value}%`),
    ))!);
    const majors = filterValues(filters?.primaryMajor);
    if (majors.length) conditions.push(or(...majors.map(value => ilike(users.primaryMajor, `%${value}%`)))!);

    const rows = await this.db
      .select({
        email: users.email,
        nameKo: users.nameKo,
        studentNumber: users.stdNo,
      })
      .from(users)
      .leftJoin(studentFeeStatus, eq(users.userId, studentFeeStatus.userId))
      .where(and(...conditions))
      .orderBy(asc(users.nameKo), asc(users.email));

    return rows.filter((row) => row.email.trim().length > 0);
  }

  async listAdminUsers(input: {
    page?: number;
    pageSize?: number;
    query?: string;
    sortBy?: AdminUserSortBy;
    sortDirection?: SortDirection;
    status?: "active" | "inactive";
    majorType?: "PRIMARY";
    feeStatus?: "PAID" | "PARTIAL" | "UNPAID";
    academicStatus?: string;
  }): Promise<AdminUserListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.query?.trim() ?? "";
    const baseConditions = [
      normalizedQuery
        ? or(
            ilike(users.nameKo, `%${normalizedQuery}%`),
            ilike(users.nameEn, `%${normalizedQuery}%`),
            ilike(users.stdNo, `%${normalizedQuery}%`),
            ilike(users.email, `%${normalizedQuery}%`),
            ilike(users.departmentKo, `%${normalizedQuery}%`),
          )
        : undefined,
      input.status === "active"
        ? eq(users.isActive, true)
        : input.status === "inactive"
          ? eq(users.isActive, false)
          : undefined,
    ].filter(Boolean) as SQL[];
    const conditions = [...baseConditions];
    const effectiveStatus = effectiveFeeStatusSql();
    if (input.majorType === "PRIMARY") conditions.push(sql`nullif(trim(${users.primaryMajor}), '') is not null`);
    if (input.feeStatus) conditions.push(eq(effectiveStatus, input.feeStatus));
    const whereClause =
      conditions.length === 0 ? undefined : and(...conditions);
    const direction = input.sortDirection === "desc" ? desc : asc;
    const sortBy = input.sortBy ?? "name";
    const primarySort =
      sortBy === "studentId"
        ? direction(users.stdNo)
        : sortBy === "status"
          ? direction(users.isActive)
          : sortBy === "lastLoginAt"
            ? direction(users.lastLoginAt)
            : sortBy === "createdAt"
              ? direction(users.createdAt)
              : direction(users.nameKo);

    const rows = await this.db
      .select({ ...getTableColumns(users), feeStatus: effectiveStatus })
      .from(users)
      .leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
      .where(whereClause)
      .orderBy(primarySort, asc(users.nameKo), asc(users.stdNo))
      .limit(pageSize)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
      .where(whereClause);

    const facetWhereClause = baseConditions.length === 0 ? undefined : and(...baseConditions);
    const facetRows = await this.db
      .select({
        primaryMajor: sql<number>`count(*) filter (where nullif(trim(${users.primaryMajor}), '') is not null)`,
        paid: sql<number>`count(*) filter (where ${effectiveStatus} = 'PAID')`,
        partial: sql<number>`count(*) filter (where ${effectiveStatus} = 'PARTIAL')`,
        unpaid: sql<number>`count(*) filter (where ${effectiveStatus} = 'UNPAID')`,
      })
      .from(users)
      .leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
      .where(facetWhereClause);

    return {
      items: rows.map((row) =>
        this.mapRowToAdminUserRecord(row, row.feeStatus),
      ),
      page,
      pageSize,
      total: Number(countResult[0]?.count ?? 0),
      facets: {
        primaryMajor: Number(facetRows[0]?.primaryMajor ?? 0),
        paid: Number(facetRows[0]?.paid ?? 0),
        partial: Number(facetRows[0]?.partial ?? 0),
        unpaid: Number(facetRows[0]?.unpaid ?? 0),
        academic: {
          enrolled: 0,
          graduated: 0,
          other: 0,
        },
      },
    };
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    const cachedPermissionBits = await this.redis.get(this.buildPermissionCacheKey(userId));

    if (cachedPermissionBits !== null) {
      const parsedPermissionBits = Number(cachedPermissionBits);
      if (Number.isFinite(parsedPermissionBits)) {
        return parsedPermissionBits | DEFAULT_AUTHENTICATED_PERMISSION_BITS;
      }
    }

    const now = nowDate();
    const rows = await this.db
      .select({
        permissionBits: sql<number>`COALESCE(SUM(DISTINCT ${permissions.bitValue}), 0)`,
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

    const permissionBits =
      Number(rows[0]?.permissionBits ?? 0) |
      DEFAULT_AUTHENTICATED_PERMISSION_BITS;
    await this.cachePermissionBitmask(userId, permissionBits);

    return permissionBits;
  }

  async getStudentFeePolicy(referenceSemester: string): Promise<StudentFeePolicy> {
    const [row] = await this.db.select().from(studentFeePolicies).where(lte(studentFeePolicies.effectiveSemester, referenceSemester)).orderBy(desc(studentFeePolicies.effectiveSemester), desc(studentFeePolicies.createdAt)).limit(1);
    return row ? { effectiveSemester: row.effectiveSemester, amount: row.amount, coverageSemesters: row.coverageSemesters } : { effectiveSemester: "2026-1", amount: 45_000, coverageSemesters: 6 };
  }

  async createStudentFeePolicy(input: StudentFeePolicy, actorId: string) {
    await this.db.insert(studentFeePolicies).values({ ...input, createdBy: actorId });
    return input;
  }

  /** Link untouched summaries without replacing an operator's payment ledger. */
  private async linkInitialFeeRecords(tx: PostgresTransaction, records: Array<{ userId: string; paidSemesters: number; paidAmount: number }>) {
    if (!records.length) return [];
    const paidUsers = new Set((await tx.selectDistinct({ userId: studentFeePayments.userId }).from(studentFeePayments)
      .where(inArray(studentFeePayments.userId, records.map(record => record.userId)))).map(row => row.userId));
    records = records.filter(record => !paidUsers.has(record.userId));
    if (!records.length) return [];
    return tx.insert(studentFeeStatus).values(records.map((record) => ({
      userId: record.userId, coverageSemesters: record.paidSemesters, paidAmount: record.paidAmount,
      status: initialFeeRosterStatus(record.paidSemesters), note: INITIAL_FEE_ROSTER_NOTE,
    }))).onConflictDoUpdate({
      target: studentFeeStatus.userId,
      set: { coverageSemesters: sql`excluded.coverage_semesters`, paidAmount: sql`excluded.paid_amount`,
        status: sql`excluded.status`, note: INITIAL_FEE_ROSTER_NOTE, updatedAt: nowDate() },
      setWhere: and(initialFeeRosterLinkAllowed(), sql`(
        ${studentFeeStatus.coverageSemesters} IS DISTINCT FROM excluded.coverage_semesters OR
        ${studentFeeStatus.paidAmount} IS DISTINCT FROM excluded.paid_amount OR
        ${studentFeeStatus.status} IS DISTINCT FROM excluded.status OR
        ${studentFeeStatus.note} IS DISTINCT FROM ${INITIAL_FEE_ROSTER_NOTE})`),
    }).returning();
  }

  /** Import is additive and idempotent: a deployment file never overwrites the DB ledger. */
  async importStudentFeeRoster(records: readonly StudentFeeBootstrapRecord[]) {
    return this.db.transaction(async (tx) => {
      let insertedCount = 0;
      let linkedCount = 0;
      for (let index = 0; index < records.length; index += 500) {
        const inserted = await tx.insert(paidStudentRecords).values(records.slice(index, index + 500).map(record => ({
          stdNo: record.stdNo, nameKo: record.nameKo ?? null, admissionYear: record.admissionYear,
          paidSemesters: record.paidSemesters, paidAmount: record.paidAmount,
        }))).onConflictDoNothing({ target: paidStudentRecords.stdNo }).returning({ stdNo: paidStudentRecords.stdNo });
        insertedCount += inserted.length;
      }
      const matched = await tx.select({ userId: users.userId, paidSemesters: paidStudentRecords.paidSemesters, paidAmount: paidStudentRecords.paidAmount })
        .from(users).innerJoin(paidStudentRecords, eq(users.stdNo, paidStudentRecords.stdNo))
        .where(notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS])).orderBy(asc(users.userId)).for("update", { of: users });
      for (let index = 0; index < matched.length; index += 500) {
        linkedCount += (await this.linkInitialFeeRecords(tx, matched.slice(index, index + 500))).length;
      }
      return { insertedCount, linkedCount };
    });
  }

  async listInitialStudentFeeRoster() {
    return this.db.select({
      stdNo: paidStudentRecords.stdNo,
      nameKo: sql<string | null>`coalesce(${users.nameKo}, ${paidStudentRecords.nameKo})`,
      admissionYear: paidStudentRecords.admissionYear, paidSemesters: paidStudentRecords.paidSemesters,
      paidAmount: paidStudentRecords.paidAmount, joinedAt: users.createdAt,
    }).from(paidStudentRecords).leftJoin(users, eq(users.stdNo, paidStudentRecords.stdNo)).orderBy(asc(paidStudentRecords.stdNo));
  }

  async listStudentFeeRoster(referenceSemester?: string): Promise<StudentFeeRosterRecord[]> {
    const reference = this.semesterOrdinal(referenceSemester) ? referenceSemester! : this.currentReferenceSemester();
    const [sources, members, statuses, payments] = await Promise.all([
      this.db.select().from(paidStudentRecords),
      this.db.select().from(users).where(notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS])),
      this.db.select().from(studentFeeStatus),
      this.db.select(getTableColumns(studentFeePayments)).from(studentFeePayments).leftJoin(users, eq(users.userId, studentFeePayments.userId))
        .where(or(isNull(studentFeePayments.userId), notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS]))),
    ]);
    const memberByNumber = new Map(members.filter(member => member.stdNo).map(member => [member.stdNo!, member]));
    const statusByUser = new Map(statuses.map(status => [status.userId, status]));
    const byUser = new Map<string, typeof payments>();
    const byNumber = new Map<string, typeof payments>();
    for (const payment of payments) {
      if (payment.userId) byUser.set(payment.userId, [...(byUser.get(payment.userId) ?? []), payment]);
      if (payment.stdNo) byNumber.set(payment.stdNo, [...(byNumber.get(payment.stdNo) ?? []), payment]);
    }
    const result: StudentFeeRosterRecord[] = [];
    const represented = new Set<string>();
    const append = (source: typeof sources[number] | undefined, member: typeof members[number] | undefined) => {
      if (member) represented.add(member.userId);
      const entries = [...new Map([...(member ? byUser.get(member.userId) ?? [] : []), ...(source ? byNumber.get(source.stdNo) ?? [] : [])].map(payment => [payment.paymentId, payment])).values()];
      entries.sort((a, b) => b.paidAt.valueOf() - a.paidAt.valueOf());
      const legacy = member ? statusByUser.get(member.userId) : undefined;
      const baseline = source?.paidAmount ?? (entries.length ? 0 : legacy?.paidAmount ?? 0);
      const status = this.feeStatusAt(legacy ?? { status: initialFeeRosterStatus(source?.paidSemesters ?? 0), paidAt: null, paidAmount: baseline, coverageSemesters: source?.paidSemesters ?? 0 }, entries, reference);
      result.push({ stdNo: source?.stdNo ?? member?.stdNo ?? "", nameKo: source?.nameKo ?? member?.nameKo ?? null,
        admissionYear: source?.admissionYear ?? null, paidSemesters: source?.paidSemesters ?? 0, paidAmount: source?.paidAmount ?? 0,
        note: source?.note ?? legacy?.note ?? null, userId: member?.userId ?? null, joinedAt: member ? msToIso(member.createdAt.valueOf()) : null,
        updatedAt: source ? msToIso(source.updatedAt.valueOf()) : null, email: member?.email ?? "", status,
        totalPaidAmount: baseline + entries.reduce((sum, payment) => sum + payment.amount, 0),
        paidAt: entries[0] ? msToIso(entries[0].paidAt.valueOf()) : legacy?.paidAt ? msToIso(legacy.paidAt.valueOf()) : null });
    };
    for (const source of sources) append(source, memberByNumber.get(source.stdNo));
    for (const member of members) if (!represented.has(member.userId)) append(undefined, member);
    return result.sort((a, b) => a.stdNo.localeCompare(b.stdNo) || (a.nameKo ?? "").localeCompare(b.nameKo ?? "", "ko"));
  }

  async getStudentFeeRosterDetail(identifier: string, referenceSemester?: string) {
    const record = (await this.listStudentFeeRoster(referenceSemester)).find(row => row.userId === identifier || row.stdNo === identifier);
    if (!record) throw new BadRequestException("fee_person_not_found");
    const conditions: SQL[] = [];
    if (record.userId) conditions.push(eq(studentFeePayments.userId, record.userId));
    if (record.stdNo) conditions.push(eq(studentFeePayments.stdNo, record.stdNo));
    const history = conditions.length ? await this.db.select().from(studentFeePayments).where(or(...conditions)).orderBy(desc(studentFeePayments.paidAt), desc(studentFeePayments.createdAt)) : [];
    return { record, history: history.map(payment => ({ ...this.mapFeePaymentRow(payment), stdNo: payment.stdNo })) };
  }

  async saveStudentFeeRoster(records: StudentFeeRosterUpdate[]): Promise<number> {
    return this.db.transaction(async tx => {
      const now = nowDate();
      for (const record of [...records].sort((a, b) => a.stdNo.localeCompare(b.stdNo))) {
        const [existing] = await tx.select().from(paidStudentRecords).where(eq(paidStudentRecords.stdNo, record.stdNo)).for("update");
        if (existing ? msToIso(existing.updatedAt.valueOf()) !== record.expectedUpdatedAt : record.expectedUpdatedAt !== null) {
          throw new ConflictException("fee_roster_changed");
        }
        const { stdNo, expectedUpdatedAt: _version, ...values } = record;
        if (existing) {
          await tx.update(paidStudentRecords).set({ ...values, updatedAt: msToDate(Math.max(now.valueOf(), existing.updatedAt.valueOf() + 1)) }).where(eq(paidStudentRecords.stdNo, stdNo));
        } else {
          const inserted = await tx.insert(paidStudentRecords).values({ stdNo, ...values, updatedAt: now })
            .onConflictDoNothing({ target: paidStudentRecords.stdNo }).returning({ stdNo: paidStudentRecords.stdNo });
          if (!inserted.length) throw new ConflictException("fee_roster_changed");
        }
      }
      const matched = await tx.select({ userId: users.userId, paidSemesters: paidStudentRecords.paidSemesters, paidAmount: paidStudentRecords.paidAmount })
        .from(users).innerJoin(paidStudentRecords, eq(users.stdNo, paidStudentRecords.stdNo))
        .where(and(inArray(paidStudentRecords.stdNo, records.map(record => record.stdNo)), notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS])))
        .orderBy(asc(users.userId)).for("update", { of: users });
      await this.linkInitialFeeRecords(tx, matched);
      return records.length;
    });
  }

  async linkInitialStudentFeeRecord(userId: string, stdNo: string | null | undefined) {
    const normalized = stdNo?.trim();
    if (!normalized || !/^\d{8}$/.test(normalized)) return { record: null, changed: false };
    const row = await this.db.transaction(async (tx) => {
      const [source] = await tx.select().from(paidStudentRecords).where(eq(paidStudentRecords.stdNo, normalized)).for("update").limit(1);
      if (!source) return { record: null, changed: false };
      const [user] = await tx.select({ userId: users.userId }).from(users)
        .where(and(eq(users.userId, userId), eq(users.stdNo, normalized))).for("update").limit(1);
      if (!user) return { record: null, changed: false };
      const attached = await tx.update(studentFeePayments).set({ userId, updatedAt: nowDate() })
        .where(and(eq(studentFeePayments.stdNo, normalized), isNull(studentFeePayments.userId))).returning();
      if (attached.length) {
        const latest = attached.sort((a, b) => b.paidAt.valueOf() - a.paidAt.valueOf())[0];
        await tx.insert(studentFeeStatus).values({ userId, status: "PAID", paidAmount: latest.amount, coverageSemesters: latest.coverageSemesters,
          paidAt: latest.paidAt, verifiedBy: latest.recordedBy, verifiedAt: nowDate(), note: latest.note }).onConflictDoNothing({ target: studentFeeStatus.userId });
      }
      const [linked] = await this.linkInitialFeeRecords(tx, [{ userId, paidSemesters: source.paidSemesters, paidAmount: source.paidAmount }]);
      if (linked) return { record: linked, changed: true };
      const [current] = await tx.select().from(studentFeeStatus).where(eq(studentFeeStatus.userId, userId)).limit(1);
      return { record: current ?? null, changed: false };
    });
    return { record: row.record ? this.mapFeeStatusRow(row.record) : null, changed: row.changed };
  }

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    const [row] = await this.db
      .select({ record: studentFeeStatus, status: effectiveFeeStatusSql() })
      .from(users)
      .leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
      .where(eq(users.userId, userId))
      .limit(1);
    return row?.record ? { ...this.mapFeeStatusRow(row.record), status: row.status } : null;
  }

  private mapFeePaymentRow(row: typeof studentFeePayments.$inferSelect): StudentFeePaymentRecord {
    return {
      paymentId: row.paymentId,
      userId: row.userId,
      amount: row.amount,
      paymentType: row.paymentType as FeePaymentType,
      paymentMethod: row.paymentMethod as FeePaymentMethod,
      effectiveStartSemester: row.effectiveStartSemester,
      coverageSemesters: row.coverageSemesters,
      paidAt: msToIso(row.paidAt.valueOf()),
      note: row.note,
      recordedBy: row.recordedBy,
      createdAt: msToIso(row.createdAt.valueOf()),
    };
  }

  private mapFeeStatusRow(
    row: typeof studentFeeStatus.$inferSelect,
  ): StudentFeeStatusRecord {
    return {
      userId: row.userId,
      status: row.status === "PAID" ? "PAID" : row.status === "PARTIAL" && row.paidAmount > 0 ? "PARTIAL" : "UNPAID",
      coverageSemesters: row.coverageSemesters,
      paidAmount: row.paidAmount,
      paidAt: row.paidAt ? msToIso(row.paidAt.valueOf()) : null,
      verifiedBy: row.verifiedBy,
      verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
      note: row.note,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private feeStatusAt(
    legacy: { status: string | null; paidAt: Date | null; paidAmount: number | null; coverageSemesters: number | null },
    payments: { effectiveStartSemester: string; coverageSemesters: number }[],
    reference: string,
  ): FeeStatus {
    const covered = payments.some(payment => this.isSemesterCovered(payment.effectiveStartSemester, payment.coverageSemesters, reference));
    const legacyActive = legacy.paidAt === null || this.isSemesterCovered(this.semesterFromDate(legacy.paidAt), legacy.coverageSemesters ?? 6, reference);
    if (covered || (legacy.status === "PAID" && legacyActive)) return "PAID";
    return legacy.status === "PARTIAL" && (legacy.paidAmount ?? 0) > 0 && legacyActive ? "PARTIAL" : "UNPAID";
  }

  async getStudentFeeDetail(userId: string, referenceSemester?: string): Promise<StudentFeeDetailResponse | null> {
    const [user, statusRecord, history] = await Promise.all([
      this.db
        .select({
          userId: users.userId,
          nameKo: users.nameKo,
          nameEn: users.nameEn,
          stdNo: users.stdNo,
          email: users.email,
          primaryMajor: users.primaryMajor,
        })
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1),
      this.db.select().from(studentFeeStatus).where(eq(studentFeeStatus.userId, userId)).limit(1),
      this.db
        .select()
        .from(studentFeePayments)
        .where(eq(studentFeePayments.userId, userId))
        .orderBy(desc(studentFeePayments.paidAt), desc(studentFeePayments.createdAt)),
    ]);

    if (!user[0]) return null;
    const status = statusRecord[0] ? this.mapFeeStatusRow(statusRecord[0]) : await this.ensureStudentFeeStatus(userId);

    return {
      user: {
        userId: user[0].userId,
        nameKo: user[0].nameKo,
        nameEn: user[0].nameEn ?? undefined,
        stdNo: user[0].stdNo ?? undefined,
        email: user[0].email,
        primaryMajor: user[0].primaryMajor,
      },
      status: { ...status, status: this.feeStatusAt({ ...status, paidAt: status.paidAt ? isoToDate(status.paidAt) : null }, history,
        referenceSemester && /^\d{4}-[12]$/.test(referenceSemester) ? referenceSemester : this.currentReferenceSemester()) },
      history: history.map((row) => this.mapFeePaymentRow(row)),
    };
  }

  /** Apply every status update under one transaction and a deterministic user lock order. */
  async bulkUpdateStudentFeeStatuses(
    updates: Array<{
      userId: string;
      update: BulkUpdateStudentFeeStatusRequest["updates"][number];
    }>,
    verifiedBy?: string,
  ): Promise<StudentFeeStatusRecord[]> {
    return this.db.transaction(async (tx) => {
      const userIds = [...new Set(updates.map(({ userId }) => userId))].sort();
      const lockedUsers = await tx
        .select({ userId: users.userId })
        .from(users)
        .where(inArray(users.userId, userIds))
        .orderBy(asc(users.userId))
        .for("update");
      if (lockedUsers.length !== userIds.length) {
        throw new BadRequestException("fee_user_not_found");
      }

      const result: StudentFeeStatusRecord[] = [];
      for (const { userId, update } of updates) {
        const [current] = await tx
          .select()
          .from(studentFeeStatus)
          .where(eq(studentFeeStatus.userId, userId))
          .for("update")
          .limit(1);
        const currentStatus: FeeStatus =
          current?.status === "PAID" || current?.status === "PARTIAL"
            ? current.status
            : "UNPAID";
        const nextStatus = update.status ?? currentStatus;
        const statusChanged = update.status !== undefined && update.status !== currentStatus;
        const now = nowDate();
        const nextRecord = {
          coverageSemesters: update.coverageSemesters ?? current?.coverageSemesters ?? 4,
          paidAmount: update.paidAmount ?? current?.paidAmount ?? 0,
          note: update.note !== undefined ? update.note : current?.note ?? null,
          paidAt: statusChanged ? (nextStatus === "PAID" ? now : null) : current?.paidAt ?? null,
          status: nextStatus,
          updatedAt: now,
          verifiedAt: statusChanged ? now : current?.verifiedAt ?? null,
          verifiedBy: statusChanged ? verifiedBy ?? null : current?.verifiedBy ?? null,
        } as const;

        const saved = current
          ? (await tx
              .update(studentFeeStatus)
              .set(nextRecord)
              .where(eq(studentFeeStatus.userId, userId))
              .returning())[0]
          : (await tx
              .insert(studentFeeStatus)
              .values({ ...nextRecord, userId })
              .returning())[0];
        if (!saved) throw new InternalServerErrorException("fee_status_update_failed");
        result.push(this.mapFeeStatusRow(saved));
      }
      return result;
    });
  }

  async processStudentFeePayments(
    input: BulkProcessStudentFeePaymentsRequest,
    recordedBy?: string,
  ): Promise<BulkProcessStudentFeePaymentsResponse> {
    const actorUserId = recordedBy?.trim();
    if (!actorUserId) throw new BadRequestException("actor_required");
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) throw new BadRequestException("idempotency_key_required");
    const payloadHash = hashStudentFeePaymentPayload(input);

    const result = await this.db.transaction(async (tx) => {
      const [claimedBatch] = await tx
        .insert(studentFeePaymentBatches)
        .values({
          actorUserId,
          idempotencyKey,
          payloadHash,
          result: null,
          updatedAt: nowDate(),
        })
        .onConflictDoNothing({
          target: [
            studentFeePaymentBatches.actorUserId,
            studentFeePaymentBatches.idempotencyKey,
          ],
        })
        .returning();

      if (!claimedBatch) {
        const [existingBatch] = await tx
          .select()
          .from(studentFeePaymentBatches)
          .where(
            and(
              eq(studentFeePaymentBatches.actorUserId, actorUserId),
              eq(studentFeePaymentBatches.idempotencyKey, idempotencyKey),
            ),
          )
          .for("update");
        if (!existingBatch) {
          throw new InternalServerErrorException("fee_payment_idempotency_record_missing");
        }
        if (existingBatch.payloadHash !== payloadHash) {
          throw new ConflictException("fee_payment_idempotency_conflict");
        }
        if (!existingBatch.result) {
          throw new ConflictException("fee_payment_idempotency_in_progress");
        }
        return existingBatch.result as unknown as BulkProcessStudentFeePaymentsResponse;
      }

      const updated: StudentFeeStatusRecord[] = [];
      const payments: StudentFeePaymentRecord[] = [];

      // Lock all roster targets first, then accounts, in a deterministic order.
      const rosterNumbers = [...new Set(input.payments.flatMap(payment => payment.stdNo ? [payment.stdNo] : []))].sort();
      if (rosterNumbers.length) await tx.select().from(paidStudentRecords).where(inArray(paidStudentRecords.stdNo, rosterNumbers)).orderBy(asc(paidStudentRecords.stdNo)).for("update");
      const identifiers: SQL[] = [];
      const accountIds = input.payments.flatMap(payment => payment.userId ? [payment.userId] : []);
      if (accountIds.length) identifiers.push(inArray(users.userId, accountIds));
      if (rosterNumbers.length) identifiers.push(inArray(users.stdNo, rosterNumbers));
      if (identifiers.length) await tx.select({ userId: users.userId }).from(users).where(or(...identifiers)).orderBy(asc(users.userId)).for("update");
      const ordered = [...input.payments].sort((a, b) => (a.userId ?? a.stdNo ?? "").localeCompare(b.userId ?? b.stdNo ?? ""));
      for (const target of ordered) {
        let payment = target;
        if (target.stdNo) {
          const [source] = await tx.select().from(paidStudentRecords).where(eq(paidStudentRecords.stdNo, target.stdNo));
          if (!source) throw new BadRequestException("fee_person_not_found");
          const [member] = await tx.select({ userId: users.userId }).from(users).where(eq(users.stdNo, target.stdNo));
          if (member) payment = { ...target, userId: member.userId };
          else {
            const [saved] = await tx.insert(studentFeePayments).values({ stdNo: target.stdNo, amount: target.amount, paymentType: target.paymentType,
              paymentMethod: target.paymentMethod, effectiveStartSemester: target.effectiveStartSemester, coverageSemesters: target.coverageSemesters,
              paidAt: isoToDate(target.paidAt), note: target.note ?? null, recordedBy: actorUserId }).returning();
            payments.push({ ...this.mapFeePaymentRow(saved), stdNo: saved.stdNo });
            continue;
          }
        }
        if (!payment.userId) throw new BadRequestException("fee_person_not_found");
        const lockedUser = await tx
          .select({ userId: users.userId })
          .from(users)
          .where(eq(users.userId, payment.userId))
          .for("update")
          .limit(1);
        if (!lockedUser[0]) {
          throw new BadRequestException("fee_user_not_found");
        }

        const [insertedPayment] = await tx
          .insert(studentFeePayments)
          .values({
            userId: payment.userId,
            amount: payment.amount,
            paymentType: payment.paymentType,
            paymentMethod: payment.paymentMethod,
            effectiveStartSemester: payment.effectiveStartSemester,
            coverageSemesters: payment.coverageSemesters,
            paidAt: isoToDate(payment.paidAt),
            note: payment.note ?? null,
            recordedBy: recordedBy ?? null,
            updatedAt: nowDate(),
          })
          .returning();

        if (!insertedPayment) {
          throw new InternalServerErrorException("fee_payment_insert_failed");
        }
        payments.push(this.mapFeePaymentRow(insertedPayment));

        const [current] = await tx
          .select()
          .from(studentFeeStatus)
          .where(eq(studentFeeStatus.userId, payment.userId))
          .for("update")
          .limit(1);
        const nextRecord = {
          userId: payment.userId,
          status: "PAID",
          coverageSemesters: payment.coverageSemesters,
          paidAmount: payment.amount,
          paidAt: isoToDate(payment.paidAt),
          note: payment.note ?? current?.note ?? null,
          verifiedBy: recordedBy ?? current?.verifiedBy ?? null,
          verifiedAt: nowDate(),
          updatedAt: nowDate(),
        } as const;
        const [saved] = current
          ? await tx
              .update(studentFeeStatus)
              .set(nextRecord)
              .where(eq(studentFeeStatus.userId, payment.userId))
              .returning()
          : await tx.insert(studentFeeStatus).values(nextRecord).returning();

        if (!saved) throw new InternalServerErrorException("fee_status_update_failed");
        updated.push({
          userId: saved.userId,
          status: "PAID",
          coverageSemesters: saved.coverageSemesters,
          paidAmount: saved.paidAmount,
          paidAt: saved.paidAt ? msToIso(saved.paidAt.valueOf()) : null,
          verifiedBy: saved.verifiedBy,
          verifiedAt: saved.verifiedAt ? msToIso(saved.verifiedAt.valueOf()) : null,
          note: saved.note,
          updatedAt: msToIso(saved.updatedAt.valueOf()),
        });
      }

      const response = { updated, payments, count: payments.length };
      await tx
        .update(studentFeePaymentBatches)
        .set({ result: response, updatedAt: nowDate() })
        .where(eq(studentFeePaymentBatches.batchId, claimedBatch.batchId));
      return response;
    });

    return result;
  }

  async updateStudentFeeStatus(
    userId: string,
    input: {
      status?: FeeStatus;
      coverageSemesters?: number;
      paidAmount?: number;
      note?: string | null;
      verifiedBy?: string;
    },
  ): Promise<StudentFeeStatusRecord> {
    const row = await this.db.transaction(async (tx) => {
      const lockUserIds = input.verifiedBy && input.verifiedBy !== userId
        ? [userId, input.verifiedBy].sort()
        : [userId];
      const lockedUsers = await tx
        .select({ userId: users.userId })
        .from(users)
        .where(inArray(users.userId, lockUserIds))
        .orderBy(asc(users.userId))
        .for("update")
        .limit(lockUserIds.length);

      if (!lockedUsers.some((lockedUser) => lockedUser.userId === userId)) {
        throw new InternalServerErrorException("Can't load data");
      }

      const now = nowDate();
      const existing = await tx
        .select()
        .from(studentFeeStatus)
        .where(eq(studentFeeStatus.userId, userId))
        .for("update")
        .limit(1);

      const current = existing[0];
      const currentStatus: FeeStatus =
        current?.status === "PAID" || current?.status === "PARTIAL"
          ? current.status
          : "UNPAID";
      const nextStatus = input.status ?? currentStatus;
      const statusChanged = input.status !== undefined && input.status !== currentStatus;
      const verifierChanged = statusChanged && input.verifiedBy !== undefined;
      const nextRecord = {
        coverageSemesters: input.coverageSemesters ?? current?.coverageSemesters ?? 4,
        paidAmount: input.paidAmount ?? current?.paidAmount ?? 0,
        note: input.note !== undefined ? input.note : current?.note ?? null,
        paidAt: statusChanged
          ? nextStatus === "PAID"
            ? now
            : null
          : current?.paidAt ?? null,
        status: nextStatus,
        updatedAt: now,
        verifiedAt: verifierChanged ? now : current?.verifiedAt ?? null,
        verifiedBy: verifierChanged ? input.verifiedBy : current?.verifiedBy ?? null,
      };

      if (current) {
        const updated = await tx
          .update(studentFeeStatus)
          .set(nextRecord)
          .where(eq(studentFeeStatus.userId, userId))
          .returning();
        return updated[0];
      }

      const inserted = await tx
        .insert(studentFeeStatus)
        .values({
          coverageSemesters: nextRecord.coverageSemesters,
          paidAmount: nextRecord.paidAmount,
          note: nextRecord.note,
          paidAt: nextRecord.paidAt,
          status: nextRecord.status,
          updatedAt: nextRecord.updatedAt,
          userId,
          verifiedAt: nextRecord.verifiedAt,
          verifiedBy: nextRecord.verifiedBy,
        })
        .returning();
      return inserted[0];
    });

    if (!row) {
      throw new InternalServerErrorException("Can't load data");
    }

    return {
      userId: row.userId,
      status:
        row.status === "PAID" || row.status === "PARTIAL" ? row.status : "UNPAID",
      coverageSemesters: row.coverageSemesters,
      paidAmount: row.paidAmount,
      paidAt: row.paidAt ? msToIso(row.paidAt.valueOf()) : null,
      verifiedBy: row.verifiedBy,
      verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
      note: row.note,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    const row = await this.db.transaction(async (tx) => {
      const lockedUser = await tx
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.userId, userId))
        .for("update")
        .limit(1);

      if (!lockedUser.length) {
        throw new InternalServerErrorException("Can't load data");
      }

      const rows = await tx
        .insert(studentFeeStatus)
        .values({
          userId,
          status: "UNPAID",
          coverageSemesters: 6,
          paidAmount: 0,
          updatedAt: nowDate(),
        })
        .onConflictDoUpdate({
          target: studentFeeStatus.userId,
          set: { userId: sql`EXCLUDED.user_id` },
        })
        .returning();
      return rows[0];
    });

    if (!row) {
      throw new InternalServerErrorException("Can't load data");
    }

    return {
      userId: row.userId,
      status:
        row.status === "PAID" || row.status === "PARTIAL" ? row.status : "UNPAID",
      coverageSemesters: row.coverageSemesters,
      paidAmount: row.paidAmount,
      paidAt: row.paidAt ? msToIso(row.paidAt.valueOf()) : null,
      verifiedBy: row.verifiedBy,
      verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
      note: row.note,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private currentReferenceSemester(): string {
    const now = nowDate();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() < 6 ? 1 : 2}`;
  }

  private semesterOrdinal(value: string | null | undefined): number | null {
    const match = value?.match(/^(\d{4})-([12])$/);
    if (!match) return null;
    return Number(match[1]) * 2 + Number(match[2]) - 1;
  }

  private semesterFromDate(value: Date | null | undefined): string | null {
    if (!value) return null;
    return `${value.getUTCFullYear()}-${value.getUTCMonth() < 6 ? 1 : 2}`;
  }

  private isSemesterCovered(
    startSemester: string | null | undefined,
    coverageSemesters: number | null | undefined,
    referenceSemester: string,
  ): boolean {
    const start = this.semesterOrdinal(startSemester);
    const reference = this.semesterOrdinal(referenceSemester);
    if (start === null || reference === null) return false;
    return reference >= start && reference < start + Math.max(1, coverageSemesters ?? 6);
  }

  async listStudentsByFeeStatus(
    status?: FeeStatus,
    page = 1,
    pageSize = 20,
    sortBy: StudentFeeSortBy = "name",
    sortDirection: SortDirection = "asc",
    query?: string,
    paymentYear?: number,
    majorCategory?: FeeMajorCategory,
    referenceSemester?: FeeReferenceSemester,
    userIds?: string[],
  ): Promise<StudentFeeListResponse> {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.min(1_000, Math.max(1, Math.floor(pageSize)));
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const filters: SQL[] = [
      eq(users.isActive, true),
      notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS]),
    ];
    const normalizedQuery = query?.trim();

    if (normalizedQuery) {
      const searchFilter = or(
        ilike(users.nameKo, `%${normalizedQuery}%`),
        ilike(users.nameEn, `%${normalizedQuery}%`),
        ilike(users.stdNo, `%${normalizedQuery}%`),
        ilike(users.email, `%${normalizedQuery}%`),
        ilike(users.primaryMajor, `%${normalizedQuery}%`),
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (userIds?.length) filters.push(inArray(users.userId, userIds));
    if (paymentYear !== undefined) {
      filters.push(
        sql`EXTRACT(YEAR FROM ${studentFeeStatus.paidAt}) = ${paymentYear}`,
      );
    }
    if (majorCategory === "PRIMARY") filters.push(isNotNull(users.primaryMajor));

    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await this.db
      .select({
        userId: users.userId,
        joinedAt: users.createdAt,
        nameKo: users.nameKo,
        nameEn: users.nameEn,
        stdNo: users.stdNo,
        email: users.email,
        departmentKo: users.departmentKo,
        primaryMajor: users.primaryMajor,
        status: studentFeeStatus.status,
        coverageSemesters: studentFeeStatus.coverageSemesters,
        paidAmount: studentFeeStatus.paidAmount,
        paidAt: studentFeeStatus.paidAt,
        verifiedAt: studentFeeStatus.verifiedAt,
        note: studentFeeStatus.note,
      })
      .from(users)
      .leftJoin(studentFeeStatus, eq(users.userId, studentFeeStatus.userId))
      .where(where);

    const normalizedReference = this.semesterOrdinal(referenceSemester)
      ? referenceSemester!
      : this.currentReferenceSemester();
    const feePolicy = await this.getStudentFeePolicy(normalizedReference);
    const paymentRows = rows.length
      ? await this.db
          .select()
          .from(studentFeePayments)
          .where(inArray(studentFeePayments.userId, rows.map((row) => row.userId)))
          .orderBy(desc(studentFeePayments.paidAt), desc(studentFeePayments.createdAt))
      : [];
    const paymentsByUser = new Map<string, typeof paymentRows>();
    for (const payment of paymentRows) {
      if (!payment.userId) continue;
      const existing = paymentsByUser.get(payment.userId) ?? [];
      existing.push(payment);
      paymentsByUser.set(payment.userId, existing);
    }

    const mapped = rows.map((row) => {
      const payments = paymentsByUser.get(row.userId) ?? [];
      const resolvedStatus = this.feeStatusAt(row, payments, normalizedReference);
      const eligible = resolvedStatus === "PAID";
      const legacyStartSemester = this.semesterFromDate(row.paidAt);
      const latestPayment = payments[0];
      const totalPaidAmount = payments.length
        ? payments.reduce((sum, payment) => sum + payment.amount, 0)
        : row.paidAmount ?? 0;
      return {
        status: resolvedStatus,
        eligible,
        userId: row.userId,
        joinedAt: msToIso(row.joinedAt.valueOf()),
        nameKo: row.nameKo,
        nameEn: row.nameEn ?? undefined,
        stdNo: row.stdNo ?? undefined,
        email: row.email,
        departmentKo: row.departmentKo,
        primaryMajor: row.primaryMajor,
        coverageSemesters:
          latestPayment?.coverageSemesters ?? row.coverageSemesters ?? 6,
        coverageStartSemester:
          latestPayment?.effectiveStartSemester ?? legacyStartSemester,
        paymentType: (latestPayment?.paymentType ?? null) as FeePaymentType | null,
        paymentMethod: (latestPayment?.paymentMethod ?? null) as FeePaymentMethod | null,
        paidAmount: totalPaidAmount,
        requiredAmount: feePolicy.amount,
        paidAt: latestPayment?.paidAt
          ? msToIso(latestPayment.paidAt.valueOf())
          : row.paidAt
            ? msToIso(row.paidAt.valueOf())
            : null,
        verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
        note: latestPayment?.note ?? row.note,
      };
    });

    const filtered = mapped.filter((row) => {
      if (!status) return true;
      return row.status === status;
    });
    const direction = sortDirection === "desc" ? -1 : 1;
    const sorted = [...filtered].sort((left, right) => {
      const leftValue =
        sortBy === "studentId"
          ? left.stdNo ?? ""
          : sortBy === "status"
            ? left.status
            : sortBy === "paidAt"
              ? left.paidAt ?? ""
              : left.nameKo;
      const rightValue =
        sortBy === "studentId"
          ? right.stdNo ?? ""
          : sortBy === "status"
            ? right.status
            : sortBy === "paidAt"
              ? right.paidAt ?? ""
              : right.nameKo;
      return String(leftValue).localeCompare(String(rightValue), "ko") * direction;
    });
    const paged = sorted.slice(offset, offset + normalizedPageSize);
    const summaryTotal = mapped.length;
    const summaryPaid = mapped.filter((row) => row.status === "PAID").length;
    const summaryPartial = mapped.filter((row) => row.status === "PARTIAL").length;
    const summaryUnpaid = summaryTotal - summaryPaid - summaryPartial;

    return {
      students: paged,
      total: filtered.length,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      summary: {
        totalStudents: summaryTotal,
        paidStudents: summaryPaid,
        partialStudents: summaryPartial,
        unpaidStudents: summaryUnpaid,
        paymentRate:
          summaryTotal > 0
            ? Math.round((summaryPaid / summaryTotal) * 1000) / 10
            : 0,
        paidAmount: mapped.reduce((sum, row) => sum + row.paidAmount, 0),
        referenceSemester: normalizedReference,
      },
    };
  }

  async getStudentFeeStats(options: StudentFeeStatsOptions = {}): Promise<StudentFeeStatsResponse> {
    const reference = this.semesterOrdinal(options.referenceSemester) ? options.referenceSemester! : this.currentReferenceSemester();
    const [people, policy, receipts, members] = await Promise.all([
      this.listStudentFeeRoster(reference), this.getStudentFeePolicy(reference),
      this.db.select(getTableColumns(studentFeePayments)).from(studentFeePayments).leftJoin(users, eq(users.userId, studentFeePayments.userId))
        .where(or(isNull(studentFeePayments.userId), notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS]))).orderBy(asc(studentFeePayments.paidAt)),
      this.db.select({ userId: users.userId, primaryMajor: users.primaryMajor }).from(users).where(notInArray(users.kaistUid, [...EXCLUDED_SYSTEM_TARGET_KAIST_UIDS])),
    ]);
    const start = options.dateFrom ? isoToDate(`${options.dateFrom}T00:00:00.000+09:00`).valueOf() : -Infinity;
    const endDate = options.dateTo ? isoToDate(`${options.dateTo}T00:00:00.000+09:00`) : null;
    if (endDate) endDate.setDate(endDate.getDate() + 1);
    const selected = receipts.filter(payment => payment.paidAt.valueOf() >= start && payment.paidAt.valueOf() < (endDate?.valueOf() ?? Infinity));
    const dayOf = (date: Date) => { const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(part => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}`; };
    const periodOf = (date: Date) => {
      const day = dayOf(date);
      if (options.bucket === "month") return day.slice(0, 7);
      if (options.bucket === "week") {
        const value = isoToDate(`${day}T00:00:00Z`);
        value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
        const year = value.getUTCFullYear();
        const week = Math.ceil(((value.valueOf() - isoToDate(`${year}-01-01T00:00:00Z`).valueOf()) / 86400000 + 1) / 7);
        return `${year}-W${String(week).padStart(2, "0")}`;
      }
      return day;
    };
    const groups = new Map<string, { amount: number; count: number; people: Set<string> }>();
    const halves = new Map<string, { amount: number; count: number; people: Set<string> }>();
    const add = (map: typeof groups, key: string, payment: typeof receipts[number]) => {
      const group = map.get(key) ?? { amount: 0, count: 0, people: new Set<string>() };
      group.amount += payment.amount; group.count++; group.people.add(payment.userId ?? payment.stdNo!); map.set(key, group);
    };
    selected.forEach(payment => add(groups, periodOf(payment.paidAt), payment));
    receipts.forEach(payment => { const day = dayOf(payment.paidAt); add(halves, `${day.slice(0, 4)}-${Number(day.slice(5, 7)) <= 6 ? "H1" : "H2"}`, payment); });
    let cumulativeAmount = 0; const cumulativePeople = new Set<string>();
    const trend = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => {
      cumulativeAmount += group.amount; group.people.forEach(person => cumulativePeople.add(person));
      return { period, paidAmount: group.amount, paidStudents: group.people.size, paymentCount: group.count, cumulativeAmount, cumulativeStudents: cumulativePeople.size };
    });
    const paid = people.filter(person => person.status === "PAID").length;
    const partial = people.filter(person => person.status === "PARTIAL").length;
    const collected = people.reduce((sum, person) => sum + (person.totalPaidAmount ?? 0), 0);
    const primaryIds = new Set(members.filter(member => member.primaryMajor).map(member => member.userId));
    const primary = people.filter(person => person.userId && primaryIds.has(person.userId));
    const primaryPaid = primary.filter(person => person.status === "PAID").length;
    const primaryPartial = primary.filter(person => person.status === "PARTIAL").length;
    return { totals: { totalStudents: people.length, paidStudents: paid, paidStudentCount: paid, paymentCount: selected.length,
      partialStudents: partial, unpaidStudents: people.length - paid - partial, paymentRate: people.length ? Math.round(paid / people.length * 1000) / 10 : 0,
      paidAmount: selected.reduce((sum, payment) => sum + payment.amount, 0), collectedAmount: collected,
      targetAmount: people.length * policy.amount, outstandingAmount: Math.max(0, people.length * policy.amount - collected) }, trend,
      paymentHalfBreakdown: [...halves].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => ({ period, paidAmount: group.amount, paymentCount: group.count, paidStudents: group.people.size })),
      majorBreakdown: [{ category: "PRIMARY" as const, label: "주전공", totalStudents: primary.length, paidStudents: primaryPaid, partialStudents: primaryPartial,
        unpaidStudents: primary.length - primaryPaid - primaryPartial, paymentRate: primary.length ? Math.round(primaryPaid / primary.length * 1000) / 10 : 0,
        paidAmount: selected.filter(payment => payment.userId && primaryIds.has(payment.userId)).reduce((sum, payment) => sum + payment.amount, 0) }] };
  }

  async getMyArticles(
    userId: string,
    limit: number,
    offset: number,
    query?: string,
  ): Promise<MyArticleItem[]> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
          ilike(articles.contentKo, `%${normalizedQuery}%`),
          ilike(articles.contentEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({
        articleId: articles.articleId,
        boardId: articles.boardId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        status: articles.status,
        visibilityScope: articles.visibilityScope,
        postedAt: articles.postedAt,
        boardNameKo: boards.nameKo,
        boardNameEn: boards.nameEn,
        boardCode: boards.code,
        commentCount: sql<number>`(
          select count(*)
          from ${comments}
          where ${comments.articleId} = ${articles.articleId}
            and ${comments.status} = 'PUBLISHED'
        )`,
      })
      .from(articles)
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(and(eq(articles.authorUserId, userId), eq(articles.status, 'PUBLISHED'), searchFilter))
      .orderBy(desc(articles.postedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      articleId: String(r.articleId),
      boardId: r.boardId,
      boardNameKo: r.boardNameKo,
      boardNameEn: r.boardNameEn,
      boardCode: r.boardCode,
      titleKo: r.titleKo,
      titleEn: r.titleEn,
      status: r.status as ArticleStatus,
      visibilityScope: r.visibilityScope as VisibilityScope,
      postedAt: msToIso(r.postedAt.valueOf()),
      commentCount: Number(r.commentCount),
    }));
  }

  async countMyArticles(userId: string, query?: string): Promise<number> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
          ilike(articles.contentKo, `%${normalizedQuery}%`),
          ilike(articles.contentEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articles)
      .where(and(eq(articles.authorUserId, userId), eq(articles.status, "PUBLISHED"), searchFilter));

    return Number(rows[0]?.count ?? 0);
  }

  async getMyComments(
    userId: string,
    limit: number,
    offset: number,
    query?: string,
    permission = 0,
  ): Promise<MyCommentItem[]> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(comments.content, `%${normalizedQuery}%`),
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const ranked = this.db
      .select({
        rank: sql<number>`row_number() over (partition by ${comments.articleId} order by ${comments.createdAt} desc, ${comments.commentId} desc)`.as("comment_rank"),
        commentId: comments.commentId,
        content: comments.content,
        status: comments.status,
        createdAt: comments.createdAt,
        articleId: articles.articleId,
        articleTitleKo: articles.titleKo,
        articleTitleEn: articles.titleEn,
        boardId: boards.boardId,
        boardNameKo: boards.nameKo,
        boardNameEn: boards.nameEn,
        boardCode: boards.code,
        commentCount: sql<number>`(
          select count(*)
          from ${comments} as article_comments
          where article_comments.article_id = ${comments.articleId}
            and article_comments.status = 'PUBLISHED'
        )`.as("comment_count"),
      })
      .from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(and(eq(comments.authorUserId, userId), eq(comments.status, 'PUBLISHED'), eq(articles.status, 'PUBLISHED'), readableArticleFilter(userId, permission), searchFilter))
      .as("ranked_comments");
    const rows = await this.db.select().from(ranked).where(eq(ranked.rank, 1))
      .orderBy(desc(ranked.createdAt), desc(ranked.commentId)).limit(limit).offset(offset);

    return rows.map((r) => ({
      commentId: String(r.commentId),
      articleId: String(r.articleId),
      boardId: r.boardId,
      boardNameKo: r.boardNameKo,
      boardNameEn: r.boardNameEn,
      boardCode: r.boardCode,
      articleTitleKo: r.articleTitleKo,
      articleTitleEn: r.articleTitleEn,
      commentCount: Number(r.commentCount),
      content: r.content,
      status: r.status as CommentStatus,
      createdAt: msToIso(r.createdAt.valueOf()),
    }));
  }

  async countMyComments(userId: string, query?: string, permission = 0): Promise<number> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(comments.content, `%${normalizedQuery}%`),
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({ count: sql<number>`COUNT(DISTINCT ${comments.articleId})` })
      .from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(and(eq(comments.authorUserId, userId), eq(comments.status, "PUBLISHED"), eq(articles.status, "PUBLISHED"), readableArticleFilter(userId, permission), searchFilter));

    return Number(rows[0]?.count ?? 0);
  }

  async getMySurveyResponses(
    userId: string,
    limit: number,
    offset: number,
    query?: string,
  ): Promise<MySurveyResponseItem[]> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(surveys.titleKo, `%${normalizedQuery}%`),
          ilike(surveys.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({
        responseId: surveyResponses.id,
        surveyId: surveys.surveyId,
        surveyTitleKo: surveys.titleKo,
        surveyTitleEn: surveys.titleEn,
        status: surveyResponses.status,
        submittedAt: surveyResponses.submittedAt,
      })
      .from(surveyResponses)
      .innerJoin(surveys, eq(surveyResponses.surveyId, surveys.surveyId))
      .where(and(eq(surveyResponses.userId, userId), searchFilter))
      .orderBy(desc(surveyResponses.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      responseId: r.responseId,
      surveyId: r.surveyId,
      surveyTitleKo: r.surveyTitleKo,
      surveyTitleEn: r.surveyTitleEn,
      status: r.status as ResponseStatus,
      submittedAt: r.submittedAt ? msToIso(r.submittedAt.valueOf()) : null,
    }));
  }

  async countMySurveyResponses(userId: string, query?: string): Promise<number> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(surveys.titleKo, `%${normalizedQuery}%`),
          ilike(surveys.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(surveyResponses)
      .innerJoin(surveys, eq(surveyResponses.surveyId, surveys.surveyId))
      .where(and(eq(surveyResponses.userId, userId), searchFilter));

    return Number(rows[0]?.count ?? 0);
  }

  async getMyActivities(
    userId: string,
    limit: number,
    offset: number,
    query?: string,
    permission = 0,
  ): Promise<{ items: MyActivityItem[]; total: number }> {
    type MyActivityRow = {
      activityType: "survey" | "post" | "comment" | "scrap";
      boardNameKo: string | null;
      boardNameEn: string | null;
      resourceId: string;
      titleKo: string;
      titleEn: string | null;
      commentContent: string | null;
      occurredAt: Date | string;
      articleId: string | null;
      boardCode: string | null;
      surveyId: string | null;
      totalCount: number | string;
    };

    const normalizedQuery = query?.trim();
    const postSearch = normalizedQuery
      ? sql`AND (
          ${articles.titleKo} ILIKE ${`%${normalizedQuery}%`}
          OR ${articles.titleEn} ILIKE ${`%${normalizedQuery}%`}
          OR ${articles.contentKo} ILIKE ${`%${normalizedQuery}%`}
          OR ${articles.contentEn} ILIKE ${`%${normalizedQuery}%`}
        )`
      : sql``;
    const commentSearch = normalizedQuery
      ? sql`AND (
          ${comments.content} ILIKE ${`%${normalizedQuery}%`}
          OR ${articles.titleKo} ILIKE ${`%${normalizedQuery}%`}
          OR ${articles.titleEn} ILIKE ${`%${normalizedQuery}%`}
        )`
      : sql``;
    const surveySearch = normalizedQuery
      ? sql`AND (
          ${surveys.titleKo} ILIKE ${`%${normalizedQuery}%`}
          OR ${surveys.titleEn} ILIKE ${`%${normalizedQuery}%`}
        )`
      : sql``;

    const result = await this.db.execute<MyActivityRow>(sql`
      WITH my_activity AS (
        SELECT
          'post' AS "activityType",
          ${articles.articleId}::text AS "resourceId",
          ${articles.titleKo} AS "titleKo",
          ${articles.titleEn} AS "titleEn",
          NULL::text AS "commentContent",
          ${articles.postedAt} AS "occurredAt",
          ${articles.articleId}::text AS "articleId",
          ${boards.code} AS "boardCode",
          ${boards.nameKo} AS "boardNameKo",
          ${boards.nameEn} AS "boardNameEn",
          NULL::text AS "surveyId"
        FROM ${articles}
        INNER JOIN ${boards} ON ${articles.boardId} = ${boards.boardId}
        WHERE ${articles.authorUserId} = ${userId}
          AND ${articles.status} = 'PUBLISHED'
          ${postSearch}

        UNION ALL

        SELECT
          'comment' AS "activityType",
          ${comments.commentId}::text AS "resourceId",
          ${articles.titleKo} AS "titleKo",
          ${articles.titleEn} AS "titleEn",
          ${comments.content} AS "commentContent",
          ${comments.createdAt} AS "occurredAt",
          ${articles.articleId}::text AS "articleId",
          ${boards.code} AS "boardCode",
          ${boards.nameKo} AS "boardNameKo",
          ${boards.nameEn} AS "boardNameEn",
          NULL::text AS "surveyId"
        FROM ${comments}
        INNER JOIN ${articles} ON ${comments.articleId} = ${articles.articleId}
        INNER JOIN ${boards} ON ${articles.boardId} = ${boards.boardId}
        WHERE ${comments.authorUserId} = ${userId}
          AND ${comments.status} = 'PUBLISHED'
          AND ${articles.status} = 'PUBLISHED'
          AND ${readableArticleFilter(userId, permission)}
          ${commentSearch}

        UNION ALL

        SELECT
          'scrap' AS "activityType",
          ${articles.articleId}::text AS "resourceId",
          ${articles.titleKo} AS "titleKo",
          ${articles.titleEn} AS "titleEn",
          NULL::text AS "commentContent",
          ${articleEngagements.updatedAt} AS "occurredAt",
          ${articles.articleId}::text AS "articleId",
          ${boards.code} AS "boardCode",
          ${boards.nameKo} AS "boardNameKo",
          ${boards.nameEn} AS "boardNameEn",
          NULL::text AS "surveyId"
        FROM ${articleEngagements}
        INNER JOIN ${articles} ON ${articleEngagements.articleId} = ${articles.articleId}
        INNER JOIN ${boards} ON ${articles.boardId} = ${boards.boardId}
        WHERE ${articleEngagements.userId} = ${userId}
          AND ${articleEngagements.kind} = 'SCRAP'
          AND ${articles.status} = 'PUBLISHED'
          AND ${readableArticleFilter(userId, permission)}
          ${postSearch}

        UNION ALL

        SELECT
          'survey' AS "activityType",
          ${surveyResponses.id}::text AS "resourceId",
          ${surveys.titleKo} AS "titleKo",
          ${surveys.titleEn} AS "titleEn",
          NULL::text AS "commentContent",
          COALESCE(${surveyResponses.submittedAt}, ${surveyResponses.createdAt}) AS "occurredAt",
          NULL::text AS "articleId",
          NULL::text AS "boardCode",
          NULL::text AS "boardNameKo",
          NULL::text AS "boardNameEn",
          ${surveys.surveyId}::text AS "surveyId"
        FROM ${surveyResponses}
        INNER JOIN ${surveys} ON ${surveyResponses.surveyId} = ${surveys.surveyId}
        WHERE ${surveyResponses.userId} = ${userId}
          ${surveySearch}
      ), ranked_activity AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY "activityType", CASE WHEN "activityType" = 'comment' THEN "articleId" ELSE "resourceId" END
          ORDER BY "occurredAt" DESC, "resourceId" DESC
        ) AS activity_rank FROM my_activity
      )
      SELECT *, COUNT(*) OVER()::int AS "totalCount"
      FROM ranked_activity WHERE activity_rank = 1
      ORDER BY "occurredAt" DESC, "resourceId" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const total = Number(result.rows[0]?.totalCount ?? 0);
    const items = result.rows.map((row) => ({
      articleId: row.articleId,
      boardCode: row.boardCode,
      boardNameKo: row.boardNameKo,
      boardNameEn: row.boardNameEn,
      commentContent: row.commentContent,
      occurredAt:
        row.occurredAt instanceof Date
          ? msToIso(row.occurredAt.valueOf())
          : msToIso(isoToMs(String(row.occurredAt))),
      resourceId: row.resourceId,
      surveyId: row.surveyId,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      type: row.activityType,
    }));

    return { items, total };
  }

  async getMyScraps(
    userId: string,
    limit: number,
    offset: number,
    query?: string,
    permission = 0,
  ): Promise<MyScrapItem[]> {
    const rows = await this.db
      .select({
        articleId: articles.articleId,
        boardId: boards.boardId,
        boardCode: boards.code,
        boardNameKo: boards.nameKo,
        boardNameEn: boards.nameEn,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        isPinned: articles.isPinned,
        postedAt: articles.postedAt,
        scrapUpdatedAt: articleEngagements.updatedAt,
        eventStartDate: articles.eventStartDate,
        eventEndDate: articles.eventEndDate,
      })
      .from(articleEngagements)
      .innerJoin(articles, eq(articleEngagements.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(
        and(
          eq(articleEngagements.userId, userId),
          eq(articleEngagements.kind, "SCRAP"),
          eq(articles.status, "PUBLISHED"),
          readableArticleFilter(userId, permission),
          query?.trim() ? or(ilike(articles.titleKo, `%${query.trim()}%`), ilike(articles.titleEn, `%${query.trim()}%`), ilike(articles.contentKo, `%${query.trim()}%`), ilike(articles.contentEn, `%${query.trim()}%`)) : undefined,
        ),
      )
      .orderBy(desc(articleEngagements.updatedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row): MyScrapItem => ({
      articleId: String(row.articleId),
      boardId: row.boardId,
      boardCode: row.boardCode,
      boardNameKo: row.boardNameKo,
      boardNameEn: row.boardNameEn,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      isPinned: row.isPinned,
      postedAt: msToIso(row.postedAt.valueOf()),
      scrapUpdatedAt: msToIso(row.scrapUpdatedAt.valueOf()),
      eventStartDate: row.eventStartDate ? msToIso(row.eventStartDate.valueOf()) : null,
      eventEndDate: row.eventEndDate ? msToIso(row.eventEndDate.valueOf()) : null,
    }));
  }

  async countMyScraps(userId: string, query?: string, permission = 0): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articleEngagements)
      .innerJoin(articles, eq(articleEngagements.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(
        and(
          eq(articleEngagements.userId, userId),
          eq(articleEngagements.kind, "SCRAP"),
          eq(articles.status, "PUBLISHED"),
          readableArticleFilter(userId, permission),
          query?.trim() ? or(ilike(articles.titleKo, `%${query.trim()}%`), ilike(articles.titleEn, `%${query.trim()}%`), ilike(articles.contentKo, `%${query.trim()}%`), ilike(articles.contentEn, `%${query.trim()}%`)) : undefined,
        ),
      );

    return Number(rows[0]?.count ?? 0);
  }
}
