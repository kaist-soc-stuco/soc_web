import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nowDate } from "@soc/shared";

import { UsersService } from "../users/users.service";
import { InitialAdminRepository } from "./initial-admin.repository";

export const parseInitialAdminStudentNumbers = (
  rawValue: string | undefined,
): ReadonlySet<string> =>
  new Set(
    (rawValue ?? "")
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter((value) => /^\d{8}$/.test(value)),
  );

@Injectable()
export class InitialAdminService {
  private readonly logger = new Logger(InitialAdminService.name);
  private readonly studentNumbers: ReadonlySet<string>;

  constructor(
    configService: ConfigService,
    private readonly repository: InitialAdminRepository,
    private readonly usersService: UsersService,
  ) {
    const rawValue = configService.get<string>("INITIAL__ADMIN_STDNOS");
    this.studentNumbers = parseInitialAdminStudentNumbers(rawValue);

    const configuredCount = (rawValue ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean).length;
    if (configuredCount !== this.studentNumbers.size) {
      this.logger.warn(
        "INITIAL__ADMIN_STDNOS contains an invalid or duplicate student number; only unique 8-digit values are used.",
      );
    }
  }

  async ensureRoleForUser(
    userId: string,
    studentNumber: string | undefined,
  ): Promise<boolean> {
    const normalizedStudentNumber = studentNumber?.trim();
    if (
      !normalizedStudentNumber ||
      !this.studentNumbers.has(normalizedStudentNumber)
    ) {
      return false;
    }

    const result = await this.repository.ensureRoleForUser(userId, nowDate());
    if (result === "role_missing") {
      throw new InternalServerErrorException(
        "initial_admin_role_missing_run_reference_seed",
      );
    }

    if (result === "granted") {
      await this.usersService.invalidatePermissionCache(userId);
      this.logger.log(`Granted the initial administrator role to user ${userId}`);
    }

    return true;
  }
}
