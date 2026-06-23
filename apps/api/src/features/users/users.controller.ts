import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { UpdateStudentFeeStatusSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { AuthGuard, RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";
import type { FeeStatus, UpdateStudentFeeStatusRequest } from "@soc/contracts";

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
  constructor(private readonly usersService: UsersService) {}

  @Get("me/articles")
  @UseGuards(AuthGuard)
  async getMyArticles(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.getMyArticles(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("me/comments")
  @UseGuards(AuthGuard)
  async getMyComments(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.getMyComments(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("me/survey-responses")
  @UseGuards(AuthGuard)
  async getMySurveyResponses(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.getMySurveyResponses(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("me/activity")
  @UseGuards(AuthGuard)
  async getMyActivities(
    @Req() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.usersService.getMyActivities(req.user!.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
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

  @Get("admin/list")
  @RequirePermissions(Permissions.ADMIN)
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
  @RequirePermissions(Permissions.ADMIN)
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
  ) {
    const feeStatus: FeeStatus | undefined =
      status === "PAID" || status === "UNPAID" ? status : undefined;
    const feeSortBy =
      sortBy === "studentId" ||
      sortBy === "status" ||
      sortBy === "paidAt" ||
      sortBy === "name"
        ? sortBy
        : "name";
    const feeSortDirection = sortDirection === "desc" ? "desc" : "asc";

    return this.usersService.listStudentsByFeeStatus(
      feeStatus,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      feeSortBy,
      feeSortDirection,
    );
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
        verifiedBy: req.user?.id,
      },
      {
        actorUserId: req.user?.id,
        ipAddress: req.ip,
      },
    );
  }
}
