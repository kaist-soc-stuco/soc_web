import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";

import { AuditLogService } from "../audit/audit-log.service";
import type { UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";
import type {
  AdminUserSortBy,
  EmailRecipientFilters,
  SortDirection,
  StudentFeeSortBy,
} from "./repositories/users.repository";
import type {
  StudentFeePolicy,
  StudentFeePaymentImportRow,
  ImportStudentFeePaymentsRequest,
  StudentFeeRosterUpdate,
  AdminUserListResponse,
  AdminUserRecord,
  BulkUpdateStudentFeeStatusRequest,
  BulkUpdateStudentFeeStatusResponse,
  StudentFeeImportPreview,
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
  UpdateUserPostingSuspensionRequest,
  UserPostingSuspensionResponse,
} from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";
import { EmailDeliveryService } from "../email/email-delivery.service";
import {
  GOOGLE_SHEET_RESOURCE,
  GoogleSpreadsheetSyncQueueService,
} from "../../infrastructure/google/google-spreadsheet-sync-queue.service";

interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
}

/**
 * PostgreSQL user 저장/조회 로직을 담당합니다.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditLogService: AuditLogService,
    @Optional() private readonly emailDeliveryService?: EmailDeliveryService,
    private readonly googleSheetsQueue?: GoogleSpreadsheetSyncQueueService,
  ) {}

  private normalizeListOptions(options: { page: number; limit: number }) {
    const page = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
    const limit = Number.isFinite(options.limit)
      ? Math.min(100, Math.max(1, Math.floor(options.limit)))
      : 20;
    const offset = (page - 1) * limit;

    return { limit, offset, page };
  }

  private async recordStudentFeeAccess(
    action: string,
    subjectUserIds: string[],
    filters: Record<string, unknown>,
    audit?: AuditMetadata,
  ): Promise<void> {
    if (!audit) return;
    const targets: Array<string | null> = [...new Set(subjectUserIds)];
    if (targets.length === 0) targets.push(null);
    for (const targetId of targets) {
      await this.auditLogService.record({
        action,
        actorUserId: audit.actorUserId ?? null,
        ipAddress: audit.ipAddress ?? null,
        payload: { count: targetId ? 1 : 0, filters },
        targetId,
        targetType: "student_fee_status",
      }, { required: true });
    }
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
    primaryMajor?: string;
    identityCode?: string;
    stdNo?: string;
    consentedAt?: Date;
  }): Promise<UserRecord> {
    const now = nowDate();
    return this.usersRepository.upsertByKaistUid({
      academicStatus: input.academicStatus,
      departmentEn: input.departmentEn,
      departmentKo: input.departmentKo,
      primaryMajor: input.primaryMajor,
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

  async setAccountActive(
    userId: string,
    isActive: boolean,
    audit?: AuditMetadata,
    reason = "manual",
  ): Promise<UserRecord | null> {
    if (!isActive && audit?.actorUserId?.toLowerCase() === userId.toLowerCase()) {
      throw new ForbiddenException("cannot_deactivate_self");
    }
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
      if (!isActive) {
        try {
          await this.emailDeliveryService?.send({
            recipients: [updated.email],
            subject: "[KAIST SOC] 계정 비활성화 안내",
            content: [
              `${updated.nameKo}님의 KAIST SOC 계정이 비활성화되었습니다.`,
              "",
              `사유: ${reason}`,
              "",
              "계정 복구가 필요하거나 문의할 내용이 있다면 웹사이트 우측 하단 채널톡으로 연락해 주세요.",
            ].join("\n"),
          });
        } catch (error) {
          this.logger.warn(
            `Failed to send account deactivation email to ${updated.userId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
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

  async getPostingSuspension(userId: string): Promise<UserPostingSuspensionResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException("user_not_found");
    const sanction = await this.usersRepository.getPostingSuspension(userId);
    return { userId, suspended: Boolean(sanction), sanction };
  }

  async setPostingSuspension(
    userId: string,
    input: UpdateUserPostingSuspensionRequest,
    audit?: AuditMetadata,
  ): Promise<UserPostingSuspensionResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException("user_not_found");
    if (!audit?.actorUserId) throw new BadRequestException("actor_required");

    const sanction = await this.usersRepository.setPostingSuspension({
      userId,
      suspended: input.suspended,
      reason: input.reason,
      issuedBy: audit.actorUserId,
      expiresAt: input.expiresAt ? isoToDate(input.expiresAt) : null,
    });

    await this.auditLogService.record({
      action: input.suspended ? "user.posting_suspend" : "user.posting_resume",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        reason: input.reason ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      targetId: userId,
      targetType: "user",
    });

    return { userId, suspended: Boolean(sanction), sanction };
  }

  async isPostingSuspended(userId: string): Promise<boolean> {
    return Boolean(await this.usersRepository.getPostingSuspension(userId));
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
    majorType?: "PRIMARY";
    feeStatus?: "PAID" | "PARTIAL" | "UNPAID";
    academicStatus?: string;
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
      primaryMajor?: string;
      email?: string;
      identityCode?: string;
      nameEn?: string;
      nameKo?: string;
      stdNo?: string;
    },
  ): Promise<void> {
    await this.usersRepository.updateProfile(userId, {
      ...input,
      lastLoginAt: nowDate(),
    });
  }

  getStudentFeePolicy(semester: string) { return this.usersRepository.getStudentFeePolicy(semester); }
  async createStudentFeePolicy(input: StudentFeePolicy, actorId: string) {
    const result = await this.usersRepository.createStudentFeePolicy(input, actorId);
    await this.auditLogService.record({ action: "student_fee_policy.create", actorUserId: actorId, targetType: "student_fee_policy", payload: input });
    return result;
  }

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    return this.usersRepository.getStudentFeeStatus(userId);
  }

  async getStudentFeeStatusForAdmin(
    userId: string,
    audit?: AuditMetadata,
  ): Promise<StudentFeeStatusRecord> {
    const status = await this.usersRepository.getStudentFeeStatus(userId)
      ?? await this.usersRepository.ensureStudentFeeStatus(userId);
    await this.recordStudentFeeAccess(
      "student_fee_status.status",
      [userId],
      {},
      audit,
    );
    return status;
  }

  async listStudentFeeRoster(audit?: AuditMetadata, semester?: string) {
    const records = await this.usersRepository.listStudentFeeRoster(semester);
    if (audit) await this.auditLogService.record({ action: "student_fee.roster.list", actorUserId: audit.actorUserId, ipAddress: audit.ipAddress, targetType: "paid_student_records", payload: { count: records.length } });
    return { records, total: records.length };
  }

  async getStudentFeeRosterDetail(identifier: string, semester: string | undefined, audit: AuditMetadata) {
    const result = await this.usersRepository.getStudentFeeRosterDetail(identifier, semester);
    await this.auditLogService.record({ action: "student_fee_status.detail", actorUserId: audit.actorUserId, ipAddress: audit.ipAddress, targetType: "paid_student_records", targetId: identifier });
    return result;
  }

  async saveStudentFeeRoster(records: StudentFeeRosterUpdate[], audit?: AuditMetadata) {
    const count = await this.usersRepository.saveStudentFeeRoster(records);
    await this.auditLogService.record({ action: "student_fee.roster.update", actorUserId: audit?.actorUserId, ipAddress: audit?.ipAddress,
      targetType: "paid_student_records", payload: { count, studentNumbers: records.map(record => record.stdNo) } });
    return { count };
  }

  async exportStudentFeeRoster(audit?: AuditMetadata, reason?: string, semester?: string) {
    const result = await this.listStudentFeeRoster(undefined, semester);
    await this.auditLogService.record({ action: "student_fee.roster.export", actorUserId: audit?.actorUserId, ipAddress: audit?.ipAddress,
      targetType: "paid_student_records", payload: { count: result.total, reason } });
    return result;
  }

  async listInitialStudentFeeRoster() {
    return this.usersRepository.listInitialStudentFeeRoster();
  }

  async applyStudentFeeBootstrap(
    userId: string,
    stdNo: string | null | undefined,
  ): Promise<StudentFeeStatusRecord | null> {
    const result = await this.usersRepository.linkInitialStudentFeeRecord(userId, stdNo);
    if (result.changed) {
      try { await this.googleSheetsQueue?.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES); }
      catch { this.logger.warn("initial_fee_roster_mirror_enqueue_failed"); }
    }
    return result.record;
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

    await this.googleSheetsQueue?.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);

    return record;
  }

  async previewStudentFeeImport(
    input: BulkUpdateStudentFeeStatusRequest,
    audit?: AuditMetadata,
  ): Promise<StudentFeeImportPreview> {
    const seen = new Set<string>();
    const rows: StudentFeeImportPreview["rows"] = [];
    for (const update of input.updates) {
      const user = update.userId
        ? await this.usersRepository.findById(update.userId)
        : await this.usersRepository.findByStdNo(update.stdNo!);
      const error = !user ? "USER_NOT_FOUND" : seen.has(user.userId) ? "DUPLICATE_USER" : null;
      if (user) seen.add(user.userId);
      rows.push({ identifier: update.userId ?? update.stdNo!, userId: user?.userId ?? null,
        current: user ? await this.usersRepository.getStudentFeeStatus(user.userId) : null, error });
    }
    await this.recordStudentFeeAccess(
      "student_fee_status.preview",
      rows.flatMap((row) => row.userId ? [row.userId] : []),
      { requestCount: input.updates.length },
      audit,
    );
    return { rows, canApply: rows.length > 0 && rows.every((row) => !row.error) };
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
    const userIds = resolved.map(({ userId }) => userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException("fee_duplicate_user");
    }

    // The repository owns one transaction for the complete request. The
    // audit/queue side effects run only after that transaction commits.
    const updated = await this.usersRepository.bulkUpdateStudentFeeStatuses(
      resolved,
      audit?.actorUserId ?? undefined,
    );
    await this.auditLogService.record({
      action: "student_fee_status.bulk_update",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { count: updated.length, userIds },
      targetType: "student_fee_status",
    });
    await this.googleSheetsQueue?.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);

    return { updated, count: updated.length };
  }

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    return this.usersRepository.ensureStudentFeeStatus(userId);
  }

  async getStudentFeeDetail(
    userId: string,
    referenceSemester?: string,
    audit?: AuditMetadata,
  ): Promise<StudentFeeDetailResponse | null> {
    const detail = await this.usersRepository.getStudentFeeDetail(userId, referenceSemester);
    await this.recordStudentFeeAccess(
      "student_fee_status.detail",
      detail ? [userId] : [],
      { referenceSemester: referenceSemester ?? null },
      audit,
    );
    return detail;
  }

  async cancelStudentFeePayment(paymentId: string, input: import("@soc/contracts").CancelStudentFeePaymentRequest, audit: AuditMetadata) {
    const result = await this.usersRepository.cancelStudentFeePayment(paymentId, input, audit.actorUserId!, audit.ipAddress);
    await this.googleSheetsQueue?.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);
    return result;
  }

  async processStudentFeePayments(
    input: BulkProcessStudentFeePaymentsRequest,
    audit?: AuditMetadata,
    imported?: { entries: StudentFeePaymentImportRow[]; confirmDuplicates: boolean },
  ): Promise<BulkProcessStudentFeePaymentsResponse> {
    const result = await this.usersRepository.processStudentFeePayments(
      input,
      audit?.actorUserId ?? undefined,
      imported,
    );

    await this.auditLogService.record({
      action: "student_fee_payment.process",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { count: result.count, paymentIds: result.payments.map((payment) => payment.paymentId) },
      targetType: "student_fee_payment",
    });

    await this.googleSheetsQueue?.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);

    return result;
  }

  async previewStudentFeePayments(entries: StudentFeePaymentImportRow[], audit: AuditMetadata) {
    const result = await this.usersRepository.previewStudentFeePayments(entries);
    await this.recordStudentFeeAccess("student_fee_payment.import_preview", result.rows.flatMap(row => row.userId ? [row.userId] : []), { count: entries.length, studentNumbers: entries.map(row => row.stdNo) }, audit);
    return result;
  }

  async importStudentFeePayments(input: ImportStudentFeePaymentsRequest, audit: AuditMetadata) {
    const payments = input.entries.map(row => ({
      stdNo: row.stdNo, amount: row.amount, paymentType: "SIX_SEMESTER_LUMP_SUM" as const,
      coverageSemesters: 6,
      effectiveStartSemester: `${row.paidDate.slice(0, 4)}-${Number(row.paidDate.slice(5, 7)) <= 6 ? 1 : 2}`,
      paidAt: isoToDate(`${row.paidDate}T00:00:00+09:00`).toISOString(), note: row.note ?? null,
    }));
    return this.processStudentFeePayments({ idempotencyKey: input.idempotencyKey, payments }, audit, {
      entries: input.entries, confirmDuplicates: input.confirmDuplicates,
    });
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
    audit?: AuditMetadata,
  ): Promise<StudentFeeListResponse> {
    const result = await this.usersRepository.listStudentsByFeeStatus(
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
    await this.recordStudentFeeAccess(
      "student_fee_status.list",
      result.students.map((student) => student.userId),
      {
        majorCategory: majorCategory ?? null,
        page: page ?? 1,
        pageSize: pageSize ?? 20,
        paymentYear: paymentYear ?? null,
        queryApplied: Boolean(query?.trim()),
        referenceSemester: referenceSemester ?? null,
        status: status ?? null,
        userIdFilterCount: userIds?.length ?? 0,
      },
      audit,
    );
    return result;
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
    audit?: AuditMetadata,
    downloadReason?: string,
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
    if (audit) {
      await this.auditLogService.record({
        action: "student_fee.export",
        actorUserId: audit.actorUserId ?? null,
        ipAddress: audit.ipAddress ?? null,
        payload: {
          count: items.length,
          reason: downloadReason ?? null,
          filters: {
            majorCategory: majorCategory ?? null,
            paymentYear: paymentYear ?? null,
            referenceSemester: referenceSemester ?? null,
            status: status ?? null,
            userCount: userIds?.length ?? null,
          },
        },
        targetType: "student_fee_status",
      }, { required: true });
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
    permission = 0,
  ): Promise<MyCommentListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyComments(userId, limit, offset, options.query, permission),
      this.usersRepository.countMyComments(userId, options.query, permission),
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
    permission = 0,
  ): Promise<MyActivityListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const result = await this.usersRepository.getMyActivities(
      userId,
      limit,
      offset,
      options.query,
      permission,
    );

    return { items: result.items, limit, page, total: result.total };
  }

  async getMyScraps(
    userId: string,
    options: { page: number; limit: number; query?: string },
    permission = 0,
  ): Promise<MyScrapListResponse> {
    const { limit, offset, page } = this.normalizeListOptions(options);
    const [items, total] = await Promise.all([
      this.usersRepository.getMyScraps(userId, limit, offset, options.query, permission),
      this.usersRepository.countMyScraps(userId, options.query, permission),
    ]);

    return { items, limit, page, total };
  }
}
