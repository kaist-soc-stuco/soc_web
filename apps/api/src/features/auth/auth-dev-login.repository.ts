import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  permissions,
  roleGroupPermissions,
  roleGroups,
  userRoleGroups,
} from "../../infrastructure/postgres/postgres.schema";

const DEV_ADMIN_ROLE_GROUP_NAME = "개발 관리자";
const DEV_ADMIN_ROLE_GROUP_DESCRIPTION = "개발 환경용 권한 테스트 그룹";
const REQUIRED_DEV_PERMISSION_CODES = [
  "ADMIN",
  "MANAGE_SURVEY",
  "MANAGE_FINANCE",
] as const;
const OPTIONAL_DEV_PERMISSION_CODES = ["WRITE_NOTICE", "WRITE_GENERAL"] as const;

@Injectable()
export class AuthDevLoginRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async ensureDevAdminRoleForUser(userId: string, grantedAt: Date): Promise<void> {
    const permissionRows = await this.db
      .select({
        code: permissions.code,
        permissionId: permissions.permissionId,
      })
      .from(permissions)
      .where(
        inArray(permissions.code, [
          ...REQUIRED_DEV_PERMISSION_CODES,
          ...OPTIONAL_DEV_PERMISSION_CODES,
        ]),
      );

    const permissionIdByCode = new Map(
      permissionRows.map((row) => [row.code, row.permissionId]),
    );
    const missingRequiredCode = REQUIRED_DEV_PERMISSION_CODES.find(
      (code) => !permissionIdByCode.has(code),
    );

    if (missingRequiredCode) {
      throw new ForbiddenException("admin_permission_missing");
    }

    const permissionIds = [
      ...REQUIRED_DEV_PERMISSION_CODES,
      ...OPTIONAL_DEV_PERMISSION_CODES,
    ]
      .map((code) => permissionIdByCode.get(code))
      .filter((permissionId): permissionId is number => permissionId !== undefined);

    await this.db.transaction(async (tx) => {
      const [insertedRoleGroup] = await tx
        .insert(roleGroups)
        .values({
          description: DEV_ADMIN_ROLE_GROUP_DESCRIPTION,
          isSystem: true,
          nameKo: DEV_ADMIN_ROLE_GROUP_NAME,
        })
        .onConflictDoNothing()
        .returning({ roleGroupId: roleGroups.roleGroupId });

      const [existingRoleGroup] = await tx
          .select({ roleGroupId: roleGroups.roleGroupId })
          .from(roleGroups)
          .where(eq(roleGroups.nameKo, DEV_ADMIN_ROLE_GROUP_NAME))
          .limit(1);
      const roleGroup = insertedRoleGroup ?? existingRoleGroup;

      if (!roleGroup) {
        throw new ForbiddenException("mock_role_group_missing");
      }

      await tx
        .delete(roleGroupPermissions)
        .where(eq(roleGroupPermissions.roleGroupId, roleGroup.roleGroupId));

      await tx
        .insert(roleGroupPermissions)
        .values(
          permissionIds.map((permissionId) => ({
            permissionId,
            roleGroupId: roleGroup.roleGroupId,
          })),
        )
        .onConflictDoNothing();

      await tx
        .delete(userRoleGroups)
        .where(
          and(
            eq(userRoleGroups.userId, userId),
            eq(userRoleGroups.roleGroupId, roleGroup.roleGroupId),
          ),
        );

      await tx.insert(userRoleGroups).values({
        grantedAt,
        isActive: true,
        roleGroupId: roleGroup.roleGroupId,
        userId,
        validFrom: grantedAt,
        validTo: null,
      });
    });
  }
}
