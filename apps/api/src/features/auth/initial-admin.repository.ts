import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { INITIAL_ADMIN_ROLE_GROUP_NAME } from "@soc/contracts";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  roleGroups,
  userRoleGroups,
} from "../../infrastructure/postgres/postgres.schema";

export type InitialAdminGrantResult =
  | "already_granted"
  | "granted"
  | "role_missing";

@Injectable()
export class InitialAdminRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async ensureRoleForUser(
    userId: string,
    grantedAt: Date,
  ): Promise<InitialAdminGrantResult> {
    return this.db.transaction(async (tx) => {
      const [roleGroup] = await tx
        .select({ roleGroupId: roleGroups.roleGroupId })
        .from(roleGroups)
        .where(
          and(
            eq(roleGroups.nameKo, INITIAL_ADMIN_ROLE_GROUP_NAME),
            eq(roleGroups.isSystem, true),
          ),
        )
        .limit(1);

      if (!roleGroup) return "role_missing";

      const [membership] = await tx
        .select({
          isActive: userRoleGroups.isActive,
          userRoleGroupId: userRoleGroups.userRoleGroupId,
        })
        .from(userRoleGroups)
        .where(
          and(
            eq(userRoleGroups.userId, userId),
            eq(userRoleGroups.roleGroupId, roleGroup.roleGroupId),
          ),
        )
        .orderBy(desc(userRoleGroups.userRoleGroupId))
        .limit(1);

      if (membership?.isActive) return "already_granted";

      if (membership) {
        await tx
          .update(userRoleGroups)
          .set({
            grantedAt,
            grantedBy: null,
            isActive: true,
            validFrom: grantedAt,
            validTo: null,
          })
          .where(
            eq(
              userRoleGroups.userRoleGroupId,
              membership.userRoleGroupId,
            ),
          );
      } else {
        await tx.insert(userRoleGroups).values({
          grantedAt,
          grantedBy: null,
          isActive: true,
          roleGroupId: roleGroup.roleGroupId,
          userId,
          validFrom: grantedAt,
          validTo: null,
        });
      }

      return "granted";
    });
  }
}
