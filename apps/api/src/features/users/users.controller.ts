import { CancelStudentFeePaymentSchema, SaveStudentFeeRosterSchema, StudentFeePolicySchema, PreviewStudentFeePaymentsSchema, ImportStudentFeePaymentsSchema, type SaveStudentFeeRosterRequest, type StudentFeePolicy, type StudentFeePaymentImportRow, type ImportStudentFeePaymentsRequest } from "@soc/contracts";
import { Body, Controller, Get, Header, Headers, Param, Post, Put, Query, Req, StreamableFile, UseGuards } from "@nestjs/common";
import { Request } from "express";
import * as XLSX from "xlsx";
import {
  BulkProcessStudentFeePaymentsSchema,
  BulkUpdateStudentFeeStatusSchema,
  UpdateStudentFeeStatusSchema,
  UpdateUserActiveStatusSchema,
  UpdateUserPostingSuspensionSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { AuthGuard, RequireAnyPermissions, RequirePermissions } from "../auth/guards";
import { auditMetadataFromRequest } from "../audit/audit-context";
import { requireDownloadReasonHeader } from "../audit/download-reason";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { resolveFeeReferenceSemester } from "./fee-semester";
import { UsersService } from "./users.service";
import { GoogleFeeSheetsService } from "./google-fee-sheets.service";
import type {
  FeeStatus,
  FeeMajorCategory,
  StudentFeeStatsBucket,
  BulkUpdateStudentFeeStatusRequest,
  BulkProcessStudentFeePaymentsRequest,
  UpdateStudentFeeStatusRequest,
  UpdateUserActiveStatusRequest,
  UpdateUserPostingSuspensionRequest,
} from "@soc/contracts";

/**
 * 사용자 조회 관련 API 골격입니다.
 *
 * TODO:
 * - 실제로 외부에 노출할 API만 남기세요.
 * - 내부 전용이면 controller 대신 service만 두는 편이 나을 수도 있습니다.
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permission: number;
  };
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly googleFeeSheetsService: GoogleFeeSheetsService,
  ) {}

  @Get("me/articles")
  @UseGuards(AuthGuard)
  async getMyArticles(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") query?: string,
  ) {
    return this.usersService.getMyArticles(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      query,
    });
  }

  @Get("me/comments")
  @UseGuards(AuthGuard)
  async getMyComments(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") query?: string,
  ) {
    return this.usersService.getMyComments(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      query,
    }, req.user!.permission);
  }

  @Get("me/survey-responses")
  @UseGuards(AuthGuard)
  async getMySurveyResponses(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") query?: string,
  ) {
    return this.usersService.getMySurveyResponses(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      query,
    });
  }

  @Get("me/activity")
  @UseGuards(AuthGuard)
  async getMyActivities(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") query?: string,
  ) {
    return this.usersService.getMyActivities(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      query,
    }, req.user!.permission);
  }

  @Get("me/scraps")
  @UseGuards(AuthGuard)
  async getMyScraps(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") query?: string,
  ) {
    return this.usersService.getMyScraps(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      query,
    }, req.user!.permission);
  }

  /**
    * 사용자 영구 저장 여부 확인용 예시 endpoint입니다.
   */
  @Get(":userId/persisted-profile")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async getPersistedProfileStatus(@Param("userId") userId: string) {
    return {
      hasPersistedProfile: await this.usersService.hasPersistedProfile(userId),
      userId,
    };
  }

  @Put(":userId/status")
  @RequirePermissions(Permissions.MANAGE_USERS)
  async updateUserActiveStatus(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UpdateUserActiveStatusSchema))
    body: UpdateUserActiveStatusRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    const updated = await this.usersService.setAccountActive(
      userId,
      body.isActive,
      { actorUserId: req.user?.id, ipAddress: req.ip },
      body.reason ?? "admin_manual",
    );

    return {
      isActive: updated?.isActive ?? body.isActive,
      userId,
    };
  }

  @Get(":userId/sanctions/posting")
  @RequirePermissions(Permissions.MANAGE_USERS)
  async getUserPostingSuspension(@Param("userId") userId: string) {
    return this.usersService.getPostingSuspension(userId);
  }

  @Put(":userId/sanctions/posting")
  @RequirePermissions(Permissions.MANAGE_USERS)
  async updateUserPostingSuspension(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UpdateUserPostingSuspensionSchema))
    body: UpdateUserPostingSuspensionRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.setPostingSuspension(userId, body, {
      actorUserId: req.user?.id,
      ipAddress: req.ip,
    });
  }

  @Get("admin/list")
  @RequirePermissions(Permissions.MANAGE_USERS)
  async listAdminUsers(
    @Query("q") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("status") status?: string,
    @Query("majorType") majorType?: string,
    @Query("feeStatus") feeStatus?: string,
  ) {
    const adminUserSortBy =
      sortBy === "studentId" ||
      sortBy === "status" ||
      sortBy === "lastLoginAt" ||
      sortBy === "createdAt" ||
      sortBy === "name"
        ? sortBy
        : "name";
    const adminUserStatus =
      status === "active" || status === "inactive" ? status : undefined;

    return this.usersService.listAdminUsers({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      query,
      sortBy: adminUserSortBy,
      sortDirection: sortDirection === "desc" ? "desc" : "asc",
      status: adminUserStatus,
      majorType: majorType === "PRIMARY" ? majorType : undefined,
      feeStatus: feeStatus === "PAID" || feeStatus === "PARTIAL" || feeStatus === "UNPAID" ? feeStatus : undefined,
    });
  }

  @Get()
  @RequirePermissions(Permissions.MANAGE_USERS)
  async searchUsers(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.searchUsers({
      limit: limit ? Number(limit) : undefined,
      query,
    });
  }

  @Get("fee-status/roster")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  listStudentFeeRoster(@Req() req: AuthenticatedRequest, @Query("semester") semester?: string) { return this.usersService.listStudentFeeRoster(auditMetadataFromRequest(req), semester); }

  @Get("fee-status/roster/detail/:identifier")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  getStudentFeeRosterDetail(@Param("identifier") identifier: string, @Query("semester") semester: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.usersService.getStudentFeeRosterDetail(identifier, semester, auditMetadataFromRequest(req));
  }

  @Put("fee-status/roster")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  saveStudentFeeRoster(@Body(new ZodValidationPipe(SaveStudentFeeRosterSchema)) body: SaveStudentFeeRosterRequest, @Req() req: AuthenticatedRequest) {
    return this.usersService.saveStudentFeeRoster(body.records, auditMetadataFromRequest(req));
  }

  @Get("fee-status/roster/export.xlsx")
  @Header("Cache-Control", "private, no-store")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="student-fee-roster.xlsx"')
  @RequirePermissions(Permissions.EXPORT_FINANCE)
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async exportStudentFeeRoster(@Req() req: AuthenticatedRequest, @Headers("x-download-reason") reason?: string, @Query("semester") semester?: string) {
    const decodedReason = requireDownloadReasonHeader(reason);
    const { records } = await this.usersService.exportStudentFeeRoster(auditMetadataFromRequest(req), decodedReason, semester);
    const sheet = XLSX.utils.aoa_to_sheet([
      ["학번", "이름", "입학 연도", "비고", "가입 일시", "누적 수납액", "상태", "수정 일시"],
      ...records.map(row => [row.stdNo, row.nameKo ?? "", row.admissionYear ?? "",
        row.note ?? "", row.joinedAt ?? "", row.totalPaidAmount ?? 0, row.status ?? "UNPAID", row.updatedAt ?? ""]),
    ]);
    sheet["!cols"] = [14, 18, 12, 40, 28, 20, 14, 28].map(wch => ({ wch }));
    for (let row = 2; row <= records.length + 1; row++) {
      for (const column of ["F"]) if (sheet[column + row]) sheet[column + row].z = "#,##0";
    }
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "납부 관리");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["납부 현황", "이 파일은 전체 명부를 조회·보관하기 위한 파일입니다."],
      ["신규 입금", "입금 양식에 이번 입금만 입력한 뒤 입금 엑셀 가져오기로 등록하세요."],
    ]), "이용 안내");
    return new StreamableFile(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  }

  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  @Post("fee-status/payments/:paymentId/cancel")
  cancelStudentFeePayment(@Param("paymentId") paymentId: string,
    @Body(new ZodValidationPipe(CancelStudentFeePaymentSchema)) body: import("@soc/contracts").CancelStudentFeePaymentRequest, @Req() req: AuthenticatedRequest) {
    return this.usersService.cancelStudentFeePayment(paymentId, body, auditMetadataFromRequest(req));
  }

  @Get("fee-status/policy")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  getStudentFeePolicy(@Query("semester") semester?: string) {
    return this.usersService.getStudentFeePolicy(/^\d{4}-[12]$/.test(semester ?? "") ? semester! : "2026-1");
  }

  @Post("fee-status/policy")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  createStudentFeePolicy(@Body(new ZodValidationPipe(StudentFeePolicySchema)) body: StudentFeePolicy, @Req() req: AuthenticatedRequest) {
    return this.usersService.createStudentFeePolicy(body, req.user!.id);
  }

  @Get("fee-status/list")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async listStudentsByFeeStatus(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("q") query?: string,
    @Query("paymentYear") paymentYear?: string,
    @Query("referenceSemester") referenceSemester?: string,
    @Query("majorCategory") majorCategory?: string,
    @Query("userIds") userIds?: string,
  ) {
    const feeStatus: FeeStatus | undefined =
      status === "PAID" || status === "PARTIAL" || status === "UNPAID" ? status : undefined;
    const feeSortBy =
      sortBy === "studentId" ||
      sortBy === "status" ||
      sortBy === "paidAt" ||
      sortBy === "name"
        ? sortBy
        : "name";
    const feeSortDirection = sortDirection === "desc" ? "desc" : "asc";
    const feeMajorCategory: FeeMajorCategory | undefined =
      majorCategory === "PRIMARY" ? majorCategory : undefined;
    const year = paymentYear && /^\d{4}$/.test(paymentYear) ? Number(paymentYear) : undefined;

    return this.usersService.listStudentsByFeeStatus(
      feeStatus,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      feeSortBy,
      feeSortDirection,
      query,
      year,
      feeMajorCategory,
      referenceSemester,
      userIds?.split(",").filter(Boolean),
      auditMetadataFromRequest(req),
    );
  }

  @Get("fee-status/stats")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async getStudentFeeStats(
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("bucket") bucket?: string,
    @Query("referenceSemester") referenceSemester?: string,
    @Query("paymentYear") paymentYear?: string,
  ) {
    const legacyYear = paymentYear && /^\d{4}$/.test(paymentYear) ? Number(paymentYear) : undefined;
    const normalizedBucket: StudentFeeStatsBucket = bucket === "week" || bucket === "month" ? bucket : "day";
    return this.usersService.getStudentFeeStats({
      dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(dateFrom ?? "") ? dateFrom : legacyYear ? `${legacyYear}-01-01` : undefined,
      dateTo: /^\d{4}-\d{2}-\d{2}$/.test(dateTo ?? "") ? dateTo : legacyYear ? `${legacyYear}-12-31` : undefined,
      bucket: normalizedBucket,
      referenceSemester: /^\d{4}-[12]$/.test(referenceSemester ?? "") ? referenceSemester : undefined,
    });
  }

  @Post("fee-status/spreadsheet/sync")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async syncStudentFeeSpreadsheet(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("q") query?: string,
    @Query("paymentYear") paymentYear?: string,
    @Query("referenceSemester") referenceSemester?: string,
    @Query("majorCategory") majorCategory?: string,
    @Query("userIds") userIds?: string,
  ) {
    const feeStatus: FeeStatus | undefined =
      status === "PAID" || status === "PARTIAL" || status === "UNPAID" ? status : undefined;
    const feeSortBy =
      sortBy === "studentId" || sortBy === "status" || sortBy === "paidAt" || sortBy === "name"
        ? sortBy
        : "name";
    const feeSortDirection = sortDirection === "desc" ? "desc" : "asc";
    const feeMajorCategory: FeeMajorCategory | undefined =
      majorCategory === "PRIMARY" ? majorCategory : undefined;
    const year = paymentYear && /^\d{4}$/.test(paymentYear) ? Number(paymentYear) : undefined;

    return this.googleFeeSheetsService.sync({
      status: feeStatus,
      sortBy: feeSortBy,
      sortDirection: feeSortDirection,
      query,
      paymentYear: year,
      majorCategory: feeMajorCategory,
      referenceSemester,
      userIds: userIds?.split(",").filter(Boolean),
    }, auditMetadataFromRequest(req));
  }

  @Get("fee-status/spreadsheet")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async getStudentFeeSpreadsheet() {
    return this.googleFeeSheetsService.getReference();
  }

  @Post("fee-status/spreadsheet/connect")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async connectStudentFeeSpreadsheet(@Req() req: AuthenticatedRequest) {
    return this.googleFeeSheetsService.connect(auditMetadataFromRequest(req));
  }

  @Get("fee-status/export.xlsx")
  @Header("Cache-Control", "private, no-store")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="student_fee_status.xlsx"')
  @RequirePermissions(Permissions.EXPORT_FINANCE)
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async exportStudentFeeStatus(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("q") query?: string,
    @Query("paymentYear") paymentYear?: string,
    @Query("referenceSemester") referenceSemester?: string,
    @Query("majorCategory") majorCategory?: string,
    @Query("userIds") userIds?: string,
    @Headers("x-download-reason") downloadReason?: string,
  ) {
    const reason = requireDownloadReasonHeader(downloadReason);
    const feeStatus: FeeStatus | undefined =
      status === "PAID" || status === "PARTIAL" || status === "UNPAID" ? status : undefined;
    const feeSortBy =
      sortBy === "studentId" || sortBy === "status" || sortBy === "paidAt" || sortBy === "name"
        ? sortBy
        : "name";
    const feeSortDirection = sortDirection === "desc" ? "desc" : "asc";
    const feeMajorCategory: FeeMajorCategory | undefined =
      majorCategory === "PRIMARY" ? majorCategory : undefined;
    const year = paymentYear && /^\d{4}$/.test(paymentYear) ? Number(paymentYear) : undefined;
    const resolvedReferenceSemester = resolveFeeReferenceSemester(referenceSemester);
    const rows = await this.usersService.exportStudentsByFeeStatus(
      feeStatus,
      feeSortBy,
      feeSortDirection,
      query,
      year,
      feeMajorCategory,
      resolvedReferenceSemester,
      userIds?.split(",").filter(Boolean),
      auditMetadataFromRequest(req),
      reason,
    );
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["학번", "이름", "이메일", "소속", "주전공", "상태", "납부 적용 학기 수", "납부 적용 시작 학기", "총 수납액", "기준 납부액", "납부 유형", "납부 일자", "비고", "사용자 ID"],
      ...rows.map((row) => [
        row.stdNo,
        row.nameKo,
        row.email,
        row.departmentKo,
        row.primaryMajor,
        row.status,
        row.coverageSemesters,
        row.coverageStartSemester,
        row.paidAmount,
        row.requiredAmount,
        row.paymentType,
        row.paidAt,
        row.note,
        row.userId,
      ]),
    ]);
    worksheet["!cols"] = [
      { wch: 14 }, { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      { wch: 22 }, { wch: 18 }, { wch: 36 }, { wch: 38 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "과비 납부");
    const buffer = Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
    return new StreamableFile(buffer);
  }

  @Post("fee-status/preview")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  previewStudentFeeImport(
    @Body(new ZodValidationPipe(BulkUpdateStudentFeeStatusSchema)) body: BulkUpdateStudentFeeStatusRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.previewStudentFeeImport(body, auditMetadataFromRequest(req));
  }

  @Post("fee-status/bulk")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async bulkUpdateStudentFeeStatus(
    @Body(new ZodValidationPipe(BulkUpdateStudentFeeStatusSchema))
    body: BulkUpdateStudentFeeStatusRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.bulkUpdateStudentFeeStatuses(body, {
      actorUserId: req.user?.id,
      ipAddress: req.ip,
    });
  }

  @Post("fee-status/payments")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async processStudentFeePayments(
    @Body(new ZodValidationPipe(BulkProcessStudentFeePaymentsSchema))
    body: BulkProcessStudentFeePaymentsRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.processStudentFeePayments(body, {
      actorUserId: req.user?.id,
      ipAddress: req.ip,
    });
  }

  @Post("fee-status/payments/import/preview")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async previewStudentFeePayments(
    @Body(new ZodValidationPipe(PreviewStudentFeePaymentsSchema)) body: { entries: StudentFeePaymentImportRow[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.previewStudentFeePayments(body.entries, auditMetadataFromRequest(req));
  }

  @Post("fee-status/payments/import")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async importStudentFeePayments(
    @Body(new ZodValidationPipe(ImportStudentFeePaymentsSchema)) body: ImportStudentFeePaymentsRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.importStudentFeePayments(body, auditMetadataFromRequest(req));
  }

  @Get("fee-status/detail/:userId")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async getStudentFeeDetail(
    @Req() req: AuthenticatedRequest,
    @Param("userId") userId: string,
    @Query("referenceSemester") referenceSemester?: string,
  ) {
    const detail = await this.usersService.getStudentFeeDetail(
      userId,
      referenceSemester,
      auditMetadataFromRequest(req),
    );
    if (!detail) return { user: null, status: null, history: [] };
    return detail;
  }

  @Get(":userId/fee-status")
  @Header("Cache-Control", "private, no-store")
  @RequireAnyPermissions(Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE)
  async getStudentFeeStatus(
    @Req() req: AuthenticatedRequest,
    @Param("userId") userId: string,
  ) {
    return this.usersService.getStudentFeeStatusForAdmin(
      userId,
      auditMetadataFromRequest(req),
    );
  }

  @Put(":userId/fee-status")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async updateStudentFeeStatus(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UpdateStudentFeeStatusSchema)) body: UpdateStudentFeeStatusRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateStudentFeeStatus(
      userId,
      {
        ...body,
        ...(body.status !== undefined && req.user?.id
          ? { verifiedBy: req.user.id }
          : {}),
      },
      {
        actorUserId: req.user?.id,
        ipAddress: req.ip,
      },
    );
  }
}
