import { Injectable } from "@nestjs/common";

import { AuditLogService } from "../audit/audit-log.service";
import type { UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";
import type {
  AdminUserSortBy,
  SortDirection,
  StudentFeeSortBy,
} from "./repositories/users.repository";
import type {
  AdminUserListResponse,
  AdminUserRecord,
  FeeStatus,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MySurveyResponseListResponse,
  StudentFeeListResponse,
  StudentFeeStatusRecord,
} from "@soc/contracts";
import { nowDate } from "@soc/shared";

interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
}

/**
 * PostgreSQL user 저장/조회 로직을 담당합니다.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditLogService: AuditLogService,
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

  async upsertUserFromConsent(input: {
    kaistUid: string;
    nameEn?: string;
    nameKo: string;
    email: string;
    academicStatus?: string;
    departmentEn?: string;
    departmentKo?: string;
    identityCode?: string;
    stdNo?: string;
    userMobile?: string;
    consentedAt?: Date;
  }): Promise<UserRecord> {
    const now = nowDate();
    return this.usersRepository.upsertByKaistUid({
      academicStatus: input.academicStatus,
      departmentEn: input.departmentEn,
      departmentKo: input.departmentKo,
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

  async invalidatePermissionCache(userId: string): Promise<void> {
    await this.usersRepository.invalidatePermissionBitmask(userId);
  }

  async invalidatePermissionCaches(userIds: string[]): Promise<void> {
    await this.usersRepository.invalidatePermissionBitmasks(userIds);
  }

  async searchUsers(input: { query?: string; limit?: number }): Promise<AdminUserRecord[]> {
    return this.usersRepository.searchUsers(input.query, input.limit ?? 20);
  }

  async listEmailRecipients(
    recipientType: "ALL" | "PAID_STUDENTS" | "UNPAID_STUDENTS",
  ): Promise<Array<{ email: string; nameKo: string }>> {
    return this.usersRepository.listEmailRecipients(recipientType);
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

  /**
   * 현재 사용자가 개인정보를 영구 저장한 상태인지 확인합니다.
   */
  async hasPersistedProfile(userId: string): Promise<boolean> {
    const foundByInternalId = await this.usersRepository.findById(userId);
    return Boolean(foundByInternalId?.isActive);
  }

  /** SSO 최신 정보로 프로필을 부분 갱신합니다. */
  async updateProfileFromSso(
    userId: string,
    input: {
      academicStatus?: string;
      departmentEn?: string;
      departmentKo?: string;
      email?: string;
      identityCode?: string;
      nameEn?: string;
      nameKo?: string;
      stdNo?: string;
    },
  ): Promise<void> {
    await this.usersRepository.updateProfile(userId, input);
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

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    return this.usersRepository.ensureStudentFeeStatus(userId);
  }

  async listStudentsByFeeStatus(
    status?: FeeStatus,
    page?: number,
    pageSize?: number,
    sortBy?: StudentFeeSortBy,
    sortDirection?: SortDirection,
  ): Promise<StudentFeeListResponse> {
    return this.usersRepository.listStudentsByFeeStatus(
      status,
      page,
      pageSize,
      sortBy,
      sortDirection,
    );
  }

  async getMyArticles(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<MyArticleListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyArticles(userId, limit, offset),
      this.usersRepository.countMyArticles(userId),
    ]);

    return { items, limit, page, total };
  }

  async getMyComments(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<MyCommentListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyComments(userId, limit, offset),
      this.usersRepository.countMyComments(userId),
    ]);

    return { items, limit, page, total };
  }

  async getMySurveyResponses(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<MySurveyResponseListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMySurveyResponses(userId, limit, offset),
      this.usersRepository.countMySurveyResponses(userId),
    ]);

    return { items, limit, page, total };
  }

  async getMyActivities(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<MyActivityListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, articleTotal, commentTotal, surveyTotal] = await Promise.all([
      this.usersRepository.getMyActivities(userId, limit, offset),
      this.usersRepository.countMyArticles(userId),
      this.usersRepository.countMyComments(userId),
      this.usersRepository.countMySurveyResponses(userId),
    ]);

    return { items, limit, page, total: articleTotal + commentTotal + surveyTotal };
  }
}
