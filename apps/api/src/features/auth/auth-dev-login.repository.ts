import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

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
const DEV_ADMIN_ROLE_GROUP_DESCRIPTION = "개발 환경용 전체 권한 테스트 그룹";

@Injectable()
export class AuthDevLoginRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async ensureDevAdminRoleForUser(
    userId: string,
    grantedAt: Date,
  ): Promise<void> {
    const permissionRows = await this.db
      .select({
        permissionId: permissions.permissionId,
      })
      .from(permissions)
      .where(eq(permissions.isActive, true));

    if (permissionRows.length === 0) {
      throw new ForbiddenException("admin_permission_missing");
    }

    const permissionIds = permissionRows.map((row) => row.permissionId);

    await this.db.transaction(async (tx) => {
      const [insertedRoleGroup] = await tx
        .insert(roleGroups)
        .values({
          description: DEV_ADMIN_ROLE_GROUP_DESCRIPTION,
          isSystem: true,
          nameKo: DEV_ADMIN_ROLE_GROUP_NAME,
        })
        .onConflictDoUpdate({
          target: roleGroups.nameKo,
          set: {
            description: DEV_ADMIN_ROLE_GROUP_DESCRIPTION,
            isSystem: true,
          },
        })
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
