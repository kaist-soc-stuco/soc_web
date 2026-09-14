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
    const canonicalValue = configService.get<string>("INITIAL__ADMIN_STDNOS");
    const aliasValue = configService.get<string>("INITIAL_ADMIN_STDNOS");
    const rawValue = canonicalValue?.trim() ? canonicalValue : aliasValue;
    this.studentNumbers = parseInitialAdminStudentNumbers(rawValue);

    const configuredCount = (rawValue ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean).length;
    if (configuredCount !== this.studentNumbers.size) {
      this.logger.warn(
        "INITIAL__ADMIN_STDNOS (or INITIAL_ADMIN_STDNOS) contains an invalid or duplicate student number; only unique 8-digit values are used.",
      );
    }
  }

  async ensureRoleForUser(
    userId: string,
    studentNumber: string | null | undefined,
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

    // Also clear an old cache when the membership already existed. This is
    // important after a seed repaired the system role's permission set while
    // Redis still held the administrator's previous bitmask.
    if (result === "granted" || result === "already_granted") {
      await this.usersService.invalidatePermissionCache(userId);
    }

    if (result === "granted") {
      this.logger.log(`Granted the initial administrator role to user ${userId}`);
    }

    return true;
  }
}
