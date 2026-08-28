import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditLogService } from "../audit/audit-log.service";
import type { UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";
import { UserRestrictionsRepository } from "./repositories/user-restrictions.repository";
import type {
  AdminUserSortBy,
  EmailRecipientFilters,
  SortDirection,
  StudentFeeSortBy,
} from "./repositories/users.repository";
import type {
  AdminUserListResponse,
  AdminUserRecord,
  BulkUpdateStudentFeeStatusRequest,
  BulkUpdateStudentFeeStatusResponse,
  BulkProcessStudentFeePaymentsRequest,
  BulkProcessStudentFeePaymentsResponse,
  FeeMajorCategory,
  FeeStatus,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MyScrapListResponse,
  MySurveyResponseListResponse,
  StudentFeeListResponse,
  StudentFeeStatsResponse,
  StudentFeeStatsOptions,
  StudentFeeStatusRecord,
  StudentFeeDetailResponse,
  UserRestrictionCreateRequest,
  UserRestrictionResponse,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { nowDate } from "@soc/shared";

interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
  permission?: number;
}

/**
 * PostgreSQL user 저장/조회 로직을 담당합니다.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditLogService: AuditLogService,
    private readonly userRestrictionsRepository: UserRestrictionsRepository,
  ) {}

  private normalizeListOptions(options: { page: number; limit: number }) {
    const page = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
    const limit = Number.isFinite(options.limit)
      ? Math.min(100, Math.max(1, Math.floor(options.limit)))
      : 20;
    const offset = (page - 1) * limit;

    return { limit, offset, page };
  }

  /**
   * KAIST UID로 저장된 사용자를 조회합니다.
   */
  async findByKaistUid(kaistUid: string): Promise<UserRecord | null> {
    return this.usersRepository.findByKaistUid(kaistUid);
  }

  /** 내부 사용자 ID로 사용자를 조회합니다. */
  async findById(userId: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(userId);
  }

  async isUserRestricted(userId: string): Promise<boolean> {
    return this.userRestrictionsRepository.isActive(userId);
  }

  async createUserRestriction(
    userId: string,
    input: UserRestrictionCreateRequest,
    audit?: AuditMetadata,
  ): Promise<UserRestrictionResponse> {
    if (
      !Permissions.hasAny(
        audit?.permission ?? 0,
        Permissions.MODERATE_POST_COMMENT,
        Permissions.SUPER_ADMIN,
      )
    ) {
      throw new ForbiddenException("insufficient_permission");
    }

    if (!audit?.actorUserId) {
      throw new ForbiddenException("actor_required");
    }

    if (audit.actorUserId === userId) {
      throw new BadRequestException("self_restriction_not_allowed");
    }

    const target = await this.usersRepository.findById(userId);
    if (!target) throw new NotFoundException("user_not_found");

    const restriction = await this.userRestrictionsRepository.create(
      userId,
      audit.actorUserId,
      input,
    );
    await this.auditLogService.record({
      action: "user.restriction.create",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: {
        duration: input.duration,
        reasonCode: input.reasonCode,
        reasonDetail: input.reasonDetail ?? null,
      },
      targetId: userId,
      targetType: "user",
    });

    return restriction;
  }

  async upsertUserFromConsent(input: {
    kaistUid: string;
    nameEn?: string;
    nameKo: string;
    email: string;
    academicStatus?: string;
    primaryMajor?: string;
    doubleMajor?: string;
    minor?: string;
    gender?: string;
    identityCode?: string;
    stdNo?: string;
    userMobile?: string;
    consentedAt?: Date;
  }): Promise<UserRecord> {
    const now = nowDate();
    return this.usersRepository.upsertByKaistUid({
      academicStatus: input.academicStatus,
      primaryMajor: input.primaryMajor,
      doubleMajor: input.doubleMajor,
      minor: input.minor,
      gender: input.gender,
      phoneNumber: input.userMobile,
      kaistUid: input.kaistUid,
      identityCode: input.identityCode,
      nameEn: input.nameEn,
      nameKo: input.nameKo,
      stdNo: input.stdNo,
      email: input.email,
      lastLoginAt: now,
      privacyConsentAt: input.consentedAt ?? now,
    });
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    return this.usersRepository.resolvePermissionBitmaskByUserId(userId);
  }

  async listActiveRoleGroupIds(userId: string): Promise<number[]> {
    return this.usersRepository.listActiveRoleGroupIds(userId);
  }

  async invalidatePermissionCache(userId: string): Promise<void> {
    await this.usersRepository.invalidatePermissionBitmask(userId);
  }

  async invalidatePermissionCaches(userIds: string[]): Promise<void> {
    await this.usersRepository.invalidatePermissionBitmasks(userIds);
  }

  async setAccountActive(
    userId: string,
    isActive: boolean,
    audit?: AuditMetadata,
    reason = "manual",
  ): Promise<UserRecord | null> {
    const updated = await this.usersRepository.setActiveStatus(userId, isActive);

    if (updated) {
      await this.auditLogService.record({
        action: isActive ? "user.account.activate" : "user.account.expire",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: { reason },
        targetId: userId,
        targetType: "user",
      });
    }

    return updated;
  }

  async expireAccount(
    userId: string,
    reason: string,
    audit?: AuditMetadata,
  ): Promise<UserRecord | null> {
    return this.setAccountActive(userId, false, audit, reason);
  }

  async searchUsers(input: { query?: string; limit?: number }): Promise<AdminUserRecord[]> {
    return this.usersRepository.searchUsers(input.query, input.limit ?? 20);
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
    return this.usersRepository.listEmailRecipients(recipientType, filters);
  }

  async listAdminUsers(input: {
    page?: number;
    pageSize?: number;
    query?: string;
    sortBy?: AdminUserSortBy;
    sortDirection?: SortDirection;
    status?: "active" | "inactive";
  }): Promise<AdminUserListResponse> {
    return this.usersRepository.listAdminUsers(input);
  }

  /** SSO 최신 정보로 프로필을 부분 갱신합니다. */
  async updateProfileFromSso(
    userId: string,
    input: {
      academicStatus?: string;
      primaryMajor?: string;
      doubleMajor?: string;
      minor?: string;
      gender?: string;
      email?: string;
      identityCode?: string;
      nameEn?: string;
      nameKo?: string;
      stdNo?: string;
      userMobile?: string;
    },
  ): Promise<void> {
    await this.usersRepository.updateProfile(userId, {
      ...input,
      phoneNumber: input.userMobile,
    });
  }

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    return this.usersRepository.getStudentFeeStatus(userId);
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
    audit?: AuditMetadata,
  ): Promise<StudentFeeStatusRecord> {
    const record = await this.usersRepository.updateStudentFeeStatus(userId, input);

    await this.auditLogService.record({
      action: "student_fee_status.update",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { input, record },
      targetId: userId,
      targetType: "student_fee_status",
    });

    return record;
  }

  async bulkUpdateStudentFeeStatuses(
    input: BulkUpdateStudentFeeStatusRequest,
    audit?: AuditMetadata,
  ): Promise<BulkUpdateStudentFeeStatusResponse> {
    const resolved = await Promise.all(
      input.updates.map(async (update) => {
        const user = update.userId
          ? await this.usersRepository.findById(update.userId)
          : await this.usersRepository.findByStdNo(update.stdNo!);
        if (!user) {
          throw new BadRequestException(
            `fee_user_not_found:${update.userId ?? update.stdNo}`,
          );
        }
        return { update, userId: user.userId };
      }),
    );

    const updated: StudentFeeStatusRecord[] = [];
    for (const { update, userId } of resolved) {
      updated.push(
        await this.updateStudentFeeStatus(
          userId,
          {
            paidAmount: update.paidAmount,
            status: update.status,
            coverageSemesters: update.coverageSemesters,
            note: update.note,
            verifiedBy: audit?.actorUserId ?? undefined,
          },
          audit,
        ),
      );
    }

    return { updated, count: updated.length };
  }

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    return this.usersRepository.ensureStudentFeeStatus(userId);
  }

  async getStudentFeeDetail(userId: string): Promise<StudentFeeDetailResponse | null> {
    return this.usersRepository.getStudentFeeDetail(userId);
  }

  async processStudentFeePayments(
    input: BulkProcessStudentFeePaymentsRequest,
    audit?: AuditMetadata,
  ): Promise<BulkProcessStudentFeePaymentsResponse> {
    const result = await this.usersRepository.processStudentFeePayments(
      input,
      audit?.actorUserId ?? undefined,
    );

    await this.auditLogService.record({
      action: "student_fee_payment.process",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { count: result.count, paymentIds: result.payments.map((payment) => payment.paymentId) },
      targetType: "student_fee_payment",
    });

    return result;
  }

  async listStudentsByFeeStatus(
    status?: FeeStatus,
    page?: number,
    pageSize?: number,
    sortBy?: StudentFeeSortBy,
    sortDirection?: SortDirection,
    query?: string,
    paymentYear?: number,
    majorCategory?: FeeMajorCategory,
    referenceSemester?: string,
    userIds?: string[],
  ): Promise<StudentFeeListResponse> {
    return this.usersRepository.listStudentsByFeeStatus(
      status,
      page,
      pageSize,
      sortBy,
      sortDirection,
      query,
      paymentYear,
      majorCategory,
      referenceSemester,
      userIds,
    );
  }

  async getStudentFeeStats(options: StudentFeeStatsOptions = {}): Promise<StudentFeeStatsResponse> {
    return this.usersRepository.getStudentFeeStats(options);
  }

  async exportStudentsByFeeStatus(
    status?: FeeStatus,
    sortBy?: StudentFeeSortBy,
    sortDirection?: SortDirection,
    query?: string,
    paymentYear?: number,
    majorCategory?: FeeMajorCategory,
    referenceSemester?: string,
    userIds?: string[],
  ): Promise<StudentFeeListResponse["students"]> {
    const pageSize = 1_000;
    const first = await this.listStudentsByFeeStatus(
      status,
      1,
      pageSize,
      sortBy,
      sortDirection,
      query,
      paymentYear,
      majorCategory,
      referenceSemester,
      userIds,
    );
    const pages = Math.ceil(first.total / pageSize);
    const items = [...first.students];
    for (let page = 2; page <= pages; page += 1) {
      const next = await this.listStudentsByFeeStatus(
        status,
        page,
        pageSize,
        sortBy,
        sortDirection,
        query,
        paymentYear,
        majorCategory,
        referenceSemester,
        userIds,
      );
      items.push(...next.students);
    }
    return items;
  }

  async getMyArticles(
    userId: string,
    options: { page: number; limit: number; query?: string },
  ): Promise<MyArticleListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyArticles(userId, limit, offset, options.query),
      this.usersRepository.countMyArticles(userId, options.query),
    ]);

    return { items, limit, page, total };
  }

  async getMyComments(
    userId: string,
    options: { page: number; limit: number; query?: string },
  ): Promise<MyCommentListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyComments(userId, limit, offset, options.query),
      this.usersRepository.countMyComments(userId, options.query),
    ]);

    return { items, limit, page, total };
  }

  async getMySurveyResponses(
    userId: string,
    options: { page: number; limit: number; query?: string },
  ): Promise<MySurveyResponseListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMySurveyResponses(userId, limit, offset, options.query),
      this.usersRepository.countMySurveyResponses(userId, options.query),
    ]);

    return { items, limit, page, total };
  }

  async getMyActivities(
    userId: string,
    options: { page: number; limit: number; query?: string },
  ): Promise<MyActivityListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const result = await this.usersRepository.getMyActivities(
      userId,
      limit,
      offset,
      options.query,
    );

    return { items: result.items, limit, page, total: result.total };
  }

  async getMyScraps(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<MyScrapListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyScraps(userId, limit, offset),
      this.usersRepository.countMyScraps(userId),
    ]);

    return { items, limit, page, total };
  }
}
