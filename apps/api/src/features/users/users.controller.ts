import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { UpdateStudentFeeStatusSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { AuthGuard, RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";
import type { UpdateStudentFeeStatusRequest } from "@soc/contracts";

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
  ) {
    return this.usersService.listStudentsByFeeStatus(
      (status as any) || undefined,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
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
  ) {
    return this.usersService.updateStudentFeeStatus(userId, body);
  }
}
