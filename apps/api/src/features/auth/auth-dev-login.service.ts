import { ForbiddenException, Injectable } from "@nestjs/common";
import { nowDate } from "@soc/shared";

import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthDevLoginRepository } from "./auth-dev-login.repository";

@Injectable()
export class AuthDevLoginService {
  constructor(
    private readonly authDevLoginRepository: AuthDevLoginRepository,
    private readonly authSessionService: AuthSessionService,
    private readonly usersService: UsersService,
  ) {}

  async issueMockAdminSession(): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    storageMode: "persisted";
    userId: string;
  }> {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("mock_login_disabled_in_production");
    }

    const now = nowDate();
    const mockUser = await this.usersService.upsertUserFromConsent({
      academicStatus: "재학",
      consentedAt: now,
      departmentEn: "School of Computing",
      departmentKo: "전산학부",
      email: "dev-admin@kaist.ac.kr",
      identityCode: "S",
      kaistUid: "DEV0001",
      nameEn: "Development Admin",
      nameKo: "관리자",
      stdNo: "20260001",
    });

    await this.authDevLoginRepository.ensureDevAdminRoleForUser(
      mockUser.userId,
      now,
    );
    await this.usersService.invalidatePermissionCache(mockUser.userId);

    const issued = await this.authSessionService.issuePersistedSession(
      mockUser.userId,
    );

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      sessionId: issued.session.sessionId,
      storageMode: "persisted",
      userId: mockUser.userId,
    };
  }
}
