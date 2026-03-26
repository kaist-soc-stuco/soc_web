import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import {
  AuthGuard,
  PermissionFlags,
  PermissionGuard,
  RequirePermission,
} from "../../shared/guards";
import { UsersService } from "./users.service";

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
   *
   * @param userId 내부 사용자 ID
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
}
