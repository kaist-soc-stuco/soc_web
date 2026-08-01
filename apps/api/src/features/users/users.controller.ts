import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { AdminFeeListQuery, AdminFeeUpdateRequest, AdminUserListQuery, PatchMeRequest } from "@soc/contracts";
import type { Request } from "express";

import { AuthGuard } from "../../shared/guards";
import { UsersService } from "./users.service";

type AuthenticatedRequest = Request & { requestId?: string; user: { id: string } };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireAllowedKeys(value: unknown, allowedKeys: readonly string[], errorCode: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(errorCode);
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) throw new BadRequestException(errorCode);
}

function requireUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new BadRequestException("invalid_user_id");
}

@Controller("users")
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("me")
  async getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.getMe(request.user.id);
  }

  @Patch("me")
  async patchMe(@Req() request: AuthenticatedRequest, @Body() body: PatchMeRequest) {
    requireAllowedKeys(body, ["userMobile"], "invalid_profile_update");
    return this.usersService.patchMe(request.user.id, {
      userMobile: body.userMobile as string | null | undefined,
    });
  }

  @Get("me/fee")
  async getMyFee(@Req() request: AuthenticatedRequest) {
    return this.usersService.getFeeSelf(request.user.id);
  }
  @Get("admin/fees")
  async listAdminFees(@Req() request: AuthenticatedRequest, @Query() query: AdminFeeListQuery) {
    requireAllowedKeys(query, ["cursor", "limit", "name", "studentOrEmployeeNumber", "feeStatus"], "invalid_fee_query");
    return this.usersService.listAdminFees(request.user.id, query);
  }

  @Get("admin")
  async listAdmin(@Req() request: AuthenticatedRequest, @Query() query: AdminUserListQuery) {
    requireAllowedKeys(query, ["cursor", "limit", "name", "studentOrEmployeeNumber", "feeStatus"], "invalid_user_query");
    return this.usersService.listAdmin(request.user.id, query);
  }

  @Get("admin/:userId")
  async getAdmin(@Req() request: AuthenticatedRequest, @Param("userId") userId: string) {
    requireUuid(userId);
    return this.usersService.getAdmin(request.user.id, userId);
  }

  @Patch("admin/:userId/fee")
  async updateFee(
    @Req() request: AuthenticatedRequest,
    @Param("userId") userId: string,
    @Body() body: AdminFeeUpdateRequest,
  ) {
    requireAllowedKeys(body, ["feeStatus", "reasonCode", "operatorNote"], "invalid_fee_update");
    requireUuid(userId);
    return this.usersService.updateFeeAdmin(
      request.user.id,
      userId,
      { feeStatus: body.feeStatus, reasonCode: body.reasonCode, operatorNote: body.operatorNote },
      request.requestId ?? "",
    );
  }
}
