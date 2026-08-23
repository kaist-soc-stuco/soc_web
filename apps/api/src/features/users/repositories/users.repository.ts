import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { isoToDate, isoToMs, msToIso, nowDate } from "@soc/shared";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { REDIS_CLIENT } from "../../../infrastructure/redis/redis.provider";
import {
  permissions,
  roleGroupPermissions,
  studentFeePayments,
  studentFeeStatus,
  userRoleGroups,
  users,
  articles,
  boards,
  comments,
  articleEngagements,
  surveyResponses,
  surveys,
} from "../../../infrastructure/postgres/postgres.schema";

import type { UserRecord } from "../entities/user";
import type {
  AdminUserListResponse,
  AdminUserRecord,
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
  doubleMajor?: string | null;
  minor?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
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
  doubleMajor?: string | null;
  minor?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
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
export type EmailRecipientFilters = {
  query?: string;
  studentNumber?: string;
  primaryMajor?: string;
  doubleMajor?: string;
  minor?: string;
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
      doubleMajor: row.doubleMajor ?? null,
      minor: row.minor ?? null,
      gender: row.gender ?? null,
      phoneNumber: row.phoneNumber ?? null,
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
      doubleMajor: row.doubleMajor ?? null,
      minor: row.minor ?? null,
      gender: row.gender ?? null,
      phoneNumber: row.phoneNumber ?? null,
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
        academicStatus: input.academicStatus ?? null,
        kaistUid: input.kaistUid,
        lastLoginAt: input.lastLoginAt ?? nowDate(),
        nameEn: input.nameEn ?? null,
        nameKo: input.nameKo,
        stdNo: input.stdNo ?? null,
        departmentEn: input.departmentEn ?? null,
        departmentKo: input.departmentKo ?? null,
        primaryMajor: input.primaryMajor ?? null,
        doubleMajor: input.doubleMajor ?? null,
        minor: input.minor ?? null,
        gender: input.gender ?? null,
        phoneNumber: input.phoneNumber ?? null,
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
      ...(input.primaryMajor !== undefined
        ? { primaryMajor: input.primaryMajor }
        : {}),
      ...(input.doubleMajor !== undefined
        ? { doubleMajor: input.doubleMajor }
        : {}),
      ...(input.minor !== undefined ? { minor: input.minor } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.phoneNumber !== undefined
        ? { phoneNumber: input.phoneNumber }
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
          doubleMajor: input.doubleMajor ?? null,
          minor: input.minor ?? null,
          gender: input.gender ?? null,
          phoneNumber: input.phoneNumber ?? null,
          departmentEn: input.departmentEn ?? null,
          academicStatus: input.academicStatus ?? null,
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
      doubleMajor?: string | null;
      minor?: string | null;
      gender?: string | null;
      phoneNumber?: string | null;
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

    if (input.primaryMajor !== undefined) {
      updateSet.primaryMajor = input.primaryMajor;
    }

    if (input.doubleMajor !== undefined) {
      updateSet.doubleMajor = input.doubleMajor;
    }

    if (input.minor !== undefined) {
      updateSet.minor = input.minor;
    }

    if (input.gender !== undefined) {
      updateSet.gender = input.gender;
    }

    if (input.phoneNumber !== undefined) {
      updateSet.phoneNumber = input.phoneNumber;
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
      phoneNumber: string | null;
      studentNumber: string | null;
    }>
  > {
    const feeFilter =
      recipientType === "PAID_STUDENTS"
        ? eq(studentFeeStatus.status, "PAID")
        : recipientType === "UNPAID_STUDENTS"
          ? or(
              eq(studentFeeStatus.status, "UNPAID"),
              isNull(studentFeeStatus.status),
            )
          : undefined;

    const conditions: SQL[] = [eq(users.isActive, true)];
    if (feeFilter) conditions.push(feeFilter);
    const query = filters?.query?.trim();
    if (query) {
      const queryFilter = or(
        ilike(users.nameKo, `%${query}%`),
        ilike(users.nameEn, `%${query}%`),
        ilike(users.stdNo, `%${query}%`),
        ilike(users.email, `%${query}%`),
      );
      if (queryFilter) conditions.push(queryFilter);
    }
    const studentNumber = filters?.studentNumber?.trim();
    if (studentNumber === "2024_OR_EARLIER") {
      conditions.push(lt(users.stdNo, "20250000"));
    } else if (studentNumber) {
      conditions.push(ilike(users.stdNo, `%${studentNumber}%`));
    }
    if (filters?.primaryMajor?.trim()) conditions.push(ilike(users.primaryMajor, `%${filters.primaryMajor.trim()}%`));
    if (filters?.doubleMajor?.trim()) conditions.push(ilike(users.doubleMajor, `%${filters.doubleMajor.trim()}%`));
    if (filters?.minor?.trim()) conditions.push(ilike(users.minor, `%${filters.minor.trim()}%`));
    if (filters?.academicStatus?.trim()) conditions.push(eq(users.academicStatus, filters.academicStatus.trim()));

    const rows = await this.db
      .select({
        email: users.email,
        nameKo: users.nameKo,
        phoneNumber: users.phoneNumber,
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
  }): Promise<AdminUserListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.query?.trim() ?? "";
    const conditions = [
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
    ].filter(Boolean);
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
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(primarySort, asc(users.nameKo), asc(users.stdNo))
      .limit(pageSize)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(whereClause);

    const feeRows = rows.length
      ? await this.db
          .select({ userId: studentFeeStatus.userId, status: studentFeeStatus.status })
          .from(studentFeeStatus)
          .where(inArray(studentFeeStatus.userId, rows.map((row) => row.userId)))
      : [];
    const feeStatusByUserId = new Map(
      feeRows.map((row) => [
        row.userId,
        row.status === "PAID" || row.status === "PARTIAL" ? row.status : "UNPAID",
      ] as const),
    );

    return {
      items: rows.map((row) =>
        this.mapRowToAdminUserRecord(row, feeStatusByUserId.get(row.userId)),
      ),
      page,
      pageSize,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    const cachedPermissionBits = await this.redis.get(this.buildPermissionCacheKey(userId));

    if (cachedPermissionBits !== null) {
      const parsedPermissionBits = Number(cachedPermissionBits);
      if (Number.isFinite(parsedPermissionBits)) {
        return parsedPermissionBits;
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

      const permissionBits = Number(rows[0]?.permissionBits ?? 0);
      await this.cachePermissionBitmask(userId, permissionBits);

      return permissionBits;
  }

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    const found = await this.db
      .select()
      .from(studentFeeStatus)
      .where(eq(studentFeeStatus.userId, userId))
      .limit(1);

    if (!found.length) return null;

    const row = found[0];
    const normalizedStatus: FeeStatus =
      row.status === "PAID" || row.status === "PARTIAL" ? row.status : "UNPAID";

    return {
      userId: row.userId,
      status: normalizedStatus,
      coverageSemesters: row.coverageSemesters,
      paidAmount: row.paidAmount,
      paidAt: row.paidAt ? msToIso(row.paidAt.valueOf()) : null,
      verifiedBy: row.verifiedBy,
      verifiedAt: row.verifiedAt ? msToIso(row.verifiedAt.valueOf()) : null,
      note: row.note,
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
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

  async getStudentFeeDetail(userId: string): Promise<StudentFeeDetailResponse | null> {
    const [user, statusRecord, history] = await Promise.all([
      this.db
        .select({
          userId: users.userId,
          nameKo: users.nameKo,
          nameEn: users.nameEn,
          stdNo: users.stdNo,
          email: users.email,
          primaryMajor: users.primaryMajor,
          doubleMajor: users.doubleMajor,
          minor: users.minor,
        })
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1),
      this.getStudentFeeStatus(userId),
      this.db
        .select()
        .from(studentFeePayments)
        .where(eq(studentFeePayments.userId, userId))
        .orderBy(desc(studentFeePayments.paidAt), desc(studentFeePayments.createdAt)),
    ]);

    if (!user[0]) return null;
    const status = statusRecord ?? await this.ensureStudentFeeStatus(userId);

    return {
      user: {
        userId: user[0].userId,
        nameKo: user[0].nameKo,
        nameEn: user[0].nameEn ?? undefined,
        stdNo: user[0].stdNo ?? undefined,
        email: user[0].email,
        primaryMajor: user[0].primaryMajor,
        doubleMajor: user[0].doubleMajor,
        minor: user[0].minor,
      },
      status,
      history: history.map((row) => this.mapFeePaymentRow(row)),
    };
  }

  async processStudentFeePayments(
    input: BulkProcessStudentFeePaymentsRequest,
    recordedBy?: string,
  ): Promise<BulkProcessStudentFeePaymentsResponse> {
    const result = await this.db.transaction(async (tx) => {
      const updated: StudentFeeStatusRecord[] = [];
      const payments: StudentFeePaymentRecord[] = [];

      for (const payment of input.payments) {
        const lockedUser = await tx
          .select({ userId: users.userId })
          .from(users)
          .where(eq(users.userId, payment.userId))
          .for("update")
          .limit(1);
        if (!lockedUser[0]) {
          throw new InternalServerErrorException(`fee_user_not_found:${payment.userId}`);
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

      return { updated, payments };
    });

    return { ...result, count: result.updated.length };
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
    const filters: SQL[] = [];
    const normalizedQuery = query?.trim();

    if (normalizedQuery) {
      const searchFilter = or(
        ilike(users.nameKo, `%${normalizedQuery}%`),
        ilike(users.nameEn, `%${normalizedQuery}%`),
        ilike(users.stdNo, `%${normalizedQuery}%`),
        ilike(users.email, `%${normalizedQuery}%`),
        ilike(users.primaryMajor, `%${normalizedQuery}%`),
        ilike(users.doubleMajor, `%${normalizedQuery}%`),
        ilike(users.minor, `%${normalizedQuery}%`),
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
    if (majorCategory === "DOUBLE") filters.push(isNotNull(users.doubleMajor));
    if (majorCategory === "MINOR") filters.push(isNotNull(users.minor));

    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await this.db
      .select({
        userId: users.userId,
        nameKo: users.nameKo,
        nameEn: users.nameEn,
        stdNo: users.stdNo,
        email: users.email,
        departmentKo: users.departmentKo,
        primaryMajor: users.primaryMajor,
        doubleMajor: users.doubleMajor,
        minor: users.minor,
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
    const paymentRows = rows.length
      ? await this.db
          .select()
          .from(studentFeePayments)
          .where(inArray(studentFeePayments.userId, rows.map((row) => row.userId)))
          .orderBy(desc(studentFeePayments.paidAt), desc(studentFeePayments.createdAt))
      : [];
    const paymentsByUser = new Map<string, typeof paymentRows>();
    for (const payment of paymentRows) {
      const existing = paymentsByUser.get(payment.userId) ?? [];
      existing.push(payment);
      paymentsByUser.set(payment.userId, existing);
    }

    const mapped = rows.map((row) => {
      const payments = paymentsByUser.get(row.userId) ?? [];
      const coveredPayment = payments.find((payment) =>
        this.isSemesterCovered(
          payment.effectiveStartSemester,
          payment.coverageSemesters,
          normalizedReference,
        ),
      );
      const legacyStartSemester = this.semesterFromDate(row.paidAt);
      const legacyCovered =
        row.status === "PAID" &&
        (row.paidAt === null ||
          this.isSemesterCovered(
            legacyStartSemester,
            row.coverageSemesters ?? 6,
            normalizedReference,
          ));
      const eligible = Boolean(coveredPayment || legacyCovered);
      const latestPayment = payments[0];
      const totalPaidAmount = payments.length
        ? payments.reduce((sum, payment) => sum + payment.amount, 0)
        : row.paidAmount ?? 0;

      return {
        status: eligible ? ("PAID" as const) : ("UNPAID" as const),
        eligible,
        userId: row.userId,
        nameKo: row.nameKo,
        nameEn: row.nameEn ?? undefined,
        stdNo: row.stdNo ?? undefined,
        email: row.email,
        departmentKo: row.departmentKo,
        primaryMajor: row.primaryMajor,
        doubleMajor: row.doubleMajor,
        minor: row.minor,
        coverageSemesters:
          latestPayment?.coverageSemesters ?? row.coverageSemesters ?? 6,
        coverageStartSemester:
          latestPayment?.effectiveStartSemester ?? legacyStartSemester,
        paymentType: (latestPayment?.paymentType ?? null) as FeePaymentType | null,
        paymentMethod: (latestPayment?.paymentMethod ?? null) as FeePaymentMethod | null,
        paidAmount: totalPaidAmount,
        requiredAmount: 45_000,
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
      return status === "PAID" ? row.status === "PAID" : row.status === "UNPAID";
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
    const summaryUnpaid = summaryTotal - summaryPaid;

    return {
      students: paged,
      total: filtered.length,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      summary: {
        totalStudents: summaryTotal,
        paidStudents: summaryPaid,
        partialStudents: 0,
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
    const start = options.dateFrom ? isoToDate(`${options.dateFrom}T00:00:00.000+09:00`) : undefined;
    const end = options.dateTo ? isoToDate(`${options.dateTo}T00:00:00.000+09:00`) : undefined;
    if (end) end.setDate(end.getDate() + 1);
    const conditions: SQL[] = [];
    if (start) conditions.push(gte(studentFeePayments.paidAt, start));
    if (end) conditions.push(lt(studentFeePayments.paidAt, end));
    if (options.referenceSemester) conditions.push(eq(studentFeePayments.effectiveStartSemester, options.referenceSemester));

    const [paymentRows, userRows] = await Promise.all([
      this.db
        .select({
          amount: studentFeePayments.amount,
          paidAt: studentFeePayments.paidAt,
          userId: studentFeePayments.userId,
        })
        .from(studentFeePayments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(studentFeePayments.paidAt)),
      this.db.select({
        userId: users.userId,
        primaryMajor: users.primaryMajor,
        doubleMajor: users.doubleMajor,
        minor: users.minor,
      }).from(users),
    ]);

    const bucket = options.bucket ?? "day";
    const koreanDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const koreanDate = (date: Date) => {
      const parts = Object.fromEntries(koreanDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    };
    const isoWeek = (day: string) => {
      const date = isoToDate(`${day}T00:00:00.000Z`);
      const weekday = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - weekday);
      const yearStart = isoToDate(`${date.getUTCFullYear()}-01-01T00:00:00.000Z`);
      const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
      return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };
    const periodKey = (date: Date) => {
      const day = koreanDate(date);
      if (bucket === "month") return day.slice(0, 7);
      if (bucket === "week") return isoWeek(day);
      return day;
    };

    const grouped = new Map<string, { paidAmount: number; paymentCount: number; userIds: Set<string> }>();
    paymentRows.forEach((payment) => {
      const period = periodKey(payment.paidAt);
      const current = grouped.get(period) ?? { paidAmount: 0, paymentCount: 0, userIds: new Set<string>() };
      current.paidAmount += Number(payment.amount);
      current.paymentCount += 1;
      current.userIds.add(payment.userId);
      grouped.set(period, current);
    });

    const cumulativeUsers = new Set<string>();
    let cumulativeAmount = 0;
    const trend = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => {
      cumulativeAmount += value.paidAmount;
      value.userIds.forEach((userId) => cumulativeUsers.add(userId));
      return {
        period,
        paidAmount: value.paidAmount,
        paidStudents: value.userIds.size,
        paymentCount: value.paymentCount,
        cumulativeAmount,
        cumulativeStudents: cumulativeUsers.size,
      };
    });

    const paidUserIds = new Set(paymentRows.map((payment) => payment.userId));
    const paidAmount = paymentRows.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalStudents = userRows.length;
    const paidStudents = paidUserIds.size;
    const categoryDefinitions = [
      { category: "PRIMARY" as const, label: "주전공", field: "primaryMajor" as const },
      { category: "DOUBLE" as const, label: "복수전공", field: "doubleMajor" as const },
      { category: "MINOR" as const, label: "부전공", field: "minor" as const },
    ];

    return {
      totals: {
        totalStudents,
        paidStudents,
        paidStudentCount: paidStudents,
        paymentCount: paymentRows.length,
        partialStudents: 0,
        unpaidStudents: Math.max(0, totalStudents - paidStudents),
        paymentRate: totalStudents > 0 ? Math.round((paidStudents / totalStudents) * 1_000) / 10 : 0,
        paidAmount,
      },
      trend,
      majorBreakdown: categoryDefinitions.map(({ category, label, field }) => {
        const eligibleIds = new Set(userRows.filter((user) => Boolean(user[field])).map((user) => user.userId));
        const categoryPayments = paymentRows.filter((payment) => eligibleIds.has(payment.userId));
        const categoryPaidIds = new Set(categoryPayments.map((payment) => payment.userId));
        const total = eligibleIds.size;
        const paid = categoryPaidIds.size;
        return {
          category,
          label,
          totalStudents: total,
          paidStudents: paid,
          partialStudents: 0,
          unpaidStudents: Math.max(0, total - paid),
          paymentRate: total > 0 ? Math.round((paid / total) * 1_000) / 10 : 0,
          paidAmount: categoryPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        };
      }),
    };
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
  ): Promise<MyCommentItem[]> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(comments.content, `%${normalizedQuery}%`),
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({
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
      })
      .from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(and(eq(comments.authorUserId, userId), eq(comments.status, 'PUBLISHED'), searchFilter))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      commentId: String(r.commentId),
      articleId: String(r.articleId),
      boardId: r.boardId,
      boardNameKo: r.boardNameKo,
      boardNameEn: r.boardNameEn,
      boardCode: r.boardCode,
      articleTitleKo: r.articleTitleKo,
      articleTitleEn: r.articleTitleEn,
      content: r.content,
      status: r.status as CommentStatus,
      createdAt: msToIso(r.createdAt.valueOf()),
    }));
  }

  async countMyComments(userId: string, query?: string): Promise<number> {
    const normalizedQuery = query?.trim();
    const searchFilter = normalizedQuery
      ? or(
          ilike(comments.content, `%${normalizedQuery}%`),
          ilike(articles.titleKo, `%${normalizedQuery}%`),
          ilike(articles.titleEn, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .innerJoin(articles, eq(comments.articleId, articles.articleId))
      .where(and(eq(comments.authorUserId, userId), eq(comments.status, "PUBLISHED"), searchFilter));

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
  ): Promise<{ items: MyActivityItem[]; total: number }> {
    type MyActivityRow = {
      activityType: "survey" | "post" | "comment";
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
          NULL::text AS "surveyId"
        FROM ${comments}
        INNER JOIN ${articles} ON ${comments.articleId} = ${articles.articleId}
        INNER JOIN ${boards} ON ${articles.boardId} = ${boards.boardId}
        WHERE ${comments.authorUserId} = ${userId}
          AND ${comments.status} = 'PUBLISHED'
          ${commentSearch}

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
          ${surveys.surveyId}::text AS "surveyId"
        FROM ${surveyResponses}
        INNER JOIN ${surveys} ON ${surveyResponses.surveyId} = ${surveys.surveyId}
        WHERE ${surveyResponses.userId} = ${userId}
          ${surveySearch}
      )
      SELECT *, COUNT(*) OVER()::int AS "totalCount"
      FROM my_activity
      ORDER BY "occurredAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const total = Number(result.rows[0]?.totalCount ?? 0);
    const items = result.rows.map((row) => ({
      articleId: row.articleId,
      boardCode: row.boardCode,
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

  async countMyScraps(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articleEngagements)
      .innerJoin(articles, eq(articleEngagements.articleId, articles.articleId))
      .where(
        and(
          eq(articleEngagements.userId, userId),
          eq(articleEngagements.kind, "SCRAP"),
          eq(articles.status, "PUBLISHED"),
        ),
      );

    return Number(rows[0]?.count ?? 0);
  }
}
