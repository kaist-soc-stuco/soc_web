import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";

import {
  AuthGuard,
  PermissionFlags,
  PermissionGuard,
  RequirePermission,
} from "../../shared/guards";
import { UsersService } from "./users.service";
import type { UpdateStudentFeeStatusRequest } from "@soc/contracts";

/**
 * 사용자 조회 관련 API 골격입니다.
 *
 * TODO:
 * - 실제로 외부에 노출할 API만 남기세요.
 * - 내부 전용이면 controller 대신 service만 두는 편이 나을 수도 있습니다.
 */
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
    * 사용자 영구 저장 여부 확인용 예시 endpoint입니다.
   */
  @Get(":userId/persisted-profile")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.TUITION_MANAGE)
  async getPersistedProfileStatus(@Param("userId") userId: string) {
    return {
      hasPersistedProfile: await this.usersService.hasPersistedProfile(userId),
      userId,
    };
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.ADMIN)
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
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.MANAGE_FINANCE)
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
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.MANAGE_FINANCE)
  async getStudentFeeStatus(@Param("userId", ParseIntPipe) userId: string) {
    const status = await this.usersService.getStudentFeeStatus(userId);
    if (!status) {
      // 없으면 기본값으로 생성
      return this.usersService.ensureStudentFeeStatus(userId);
    }
    return status;
  }

  @Put(":userId/fee-status")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.MANAGE_FINANCE)
  async updateStudentFeeStatus(
    @Param("userId", ParseIntPipe) userId: string,
    @Body() body: UpdateStudentFeeStatusRequest,
  ) {
    return this.usersService.updateStudentFeeStatus(userId, body);
  }
}
