import { Body, Controller, Get, Header, Param, Post, Put, Query, Req, StreamableFile, UseGuards } from "@nestjs/common";
import { Request } from "express";
import * as XLSX from "xlsx";
import {
  BulkProcessStudentFeePaymentsSchema,
  BulkUpdateStudentFeeStatusSchema,
  UpdateStudentFeeStatusSchema,
  UpdateUserActiveStatusSchema,
  UserRestrictionCreateSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { AuthGuard, RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";
import { StudentFeeGoogleSheetsService } from "./student-fee-google-sheets.service";
import type {
  FeeStatus,
  FeeMajorCategory,
  StudentFeeStatsBucket,
  BulkUpdateStudentFeeStatusRequest,
  BulkProcessStudentFeePaymentsRequest,
  UpdateStudentFeeStatusRequest,
  UpdateUserActiveStatusRequest,
  UserRestrictionCreateRequest,
  UserRestrictionResponse,
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
    private readonly studentFeeGoogleSheetsService: StudentFeeGoogleSheetsService,
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
    });
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
    });
  }

  @Get("me/scraps")
  @UseGuards(AuthGuard)
  async getMyScraps(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.getMyScraps(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
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
      "admin_manual",
    );

    return {
      isActive: updated?.isActive ?? body.isActive,
      userId,
    };
  }

  @Post(":userId/restrictions")
  @UseGuards(AuthGuard)
  async createUserRestriction(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UserRestrictionCreateSchema))
    body: UserRestrictionCreateRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserRestrictionResponse> {
    return this.usersService.createUserRestriction(userId, body, {
      actorUserId: req.user?.id,
      ipAddress: req.ip,
      permission: req.user?.permission,
    });
  }

  @Get("admin/list")
  @RequirePermissions(Permissions.VIEW_USERS)
  async listAdminUsers(
    @Query("q") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("status") status?: string,
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
    });
  }

  @Get()
  @RequirePermissions(Permissions.VIEW_USERS)
  async searchUsers(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.searchUsers({
      limit: limit ? Number(limit) : undefined,
      query,
    });
  }

  @Get("fee-status/list")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async listStudentsByFeeStatus(
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
      majorCategory === "PRIMARY" || majorCategory === "DOUBLE" || majorCategory === "MINOR"
        ? majorCategory
        : undefined;
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
    );
  }

  @Get("fee-status/stats")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
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

  @Get("fee-status/export.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="student_fee_status.xlsx"')
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async exportStudentFeeStatus(
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
      majorCategory === "PRIMARY" || majorCategory === "DOUBLE" || majorCategory === "MINOR"
        ? majorCategory
        : undefined;
    const year = paymentYear && /^\d{4}$/.test(paymentYear) ? Number(paymentYear) : undefined;
    const rows = await this.usersService.exportStudentsByFeeStatus(
      feeStatus,
      feeSortBy,
      feeSortDirection,
      query,
      year,
      feeMajorCategory,
      referenceSemester,
      userIds?.split(",").filter(Boolean),
    );
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["사용자ID", "학번", "이름", "이메일", "주전공", "복수전공", "부전공", "상태", "적용학기수", "적용시작학기", "수납액", "기준금액", "납부유형", "결제수단", "혜택대상", "납부일", "비고"],
      ...rows.map((row) => [
        row.userId,
        row.stdNo,
        row.nameKo,
        row.email,
        row.primaryMajor,
        row.doubleMajor,
        row.minor,
        row.status,
        row.coverageSemesters,
        row.coverageStartSemester,
        row.paidAmount,
        row.requiredAmount,
        row.paymentType,
        row.paymentMethod,
        row.eligible ? "예" : "아니오",
        row.paidAt,
        row.note,
      ]),
    ]);
    worksheet["!cols"] = [
      { wch: 38 }, { wch: 14 }, { wch: 16 }, { wch: 32 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
      { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
      { wch: 12 }, { wch: 22 }, { wch: 36 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "과비 납부");
    const buffer = Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
    return new StreamableFile(buffer);
  }

  @Get("fee-status/google/status")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async getStudentFeeGoogleSheetsStatus() {
    return this.studentFeeGoogleSheetsService.getStatus();
  }

  @Post("fee-status/google/sync-to-google")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async syncStudentFeesToGoogleSheets(@Req() req: AuthenticatedRequest) {
    return this.studentFeeGoogleSheetsService.syncToGoogleSheets(
      req.user!.id,
      req.ip,
    );
  }

  @Post("fee-status/google/sync-from-google")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async syncStudentFeesFromGoogleSheets(@Req() req: AuthenticatedRequest) {
    return this.studentFeeGoogleSheetsService.syncFromGoogleSheets(
      req.user!.id,
      req.ip,
    );
  }

  @Post("fee-status/bulk")
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

  @Get("fee-status/detail/:userId")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async getStudentFeeDetail(@Param("userId") userId: string) {
    const detail = await this.usersService.getStudentFeeDetail(userId);
    if (!detail) return { user: null, status: null, history: [] };
    return detail;
  }

  @Get(":userId/fee-status")
  @RequirePermissions(Permissions.MANAGE_FINANCE)
  async getStudentFeeStatus(@Param("userId") userId: string) {
    const status = await this.usersService.getStudentFeeStatus(userId);
    if (!status) {
      // 없으면 기본값으로 생성
      return this.usersService.ensureStudentFeeStatus(userId);
    }
    return status;
  }

  @Put(":userId/fee-status")
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
