import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type {
  UserRestrictionCreateRequest,
  UserRestrictionResponse,
} from "@soc/contracts";
import { msToDate, msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { userRestrictions } from "../../../infrastructure/postgres/postgres.schema";

const expirationFor = (
  duration: UserRestrictionCreateRequest["duration"],
  createdAt: Date,
): Date | null => {
  const daysByDuration = {
    "1_DAY": 1,
    "3_DAYS": 3,
    "7_DAYS": 7,
    "30_DAYS": 30,
  } as const;
  const days = daysByDuration[duration as keyof typeof daysByDuration];
  if (!days) return null;

  return msToDate(createdAt.valueOf() + days * 24 * 60 * 60 * 1000);
};

@Injectable()
export class UserRestrictionsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async isActive(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ restrictionId: userRestrictions.restrictionId })
      .from(userRestrictions)
      .where(
        and(
          eq(userRestrictions.userId, userId),
          isNull(userRestrictions.revokedAt),
          or(
            isNull(userRestrictions.expiresAt),
            gt(userRestrictions.expiresAt, nowDate()),
          ),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async create(
    userId: string,
    createdByUserId: string,
    input: UserRestrictionCreateRequest,
  ): Promise<UserRestrictionResponse> {
    const createdAt = nowDate();
    const expiresAt = expirationFor(input.duration, createdAt);

    const created = await this.db.transaction(async (tx) => {
      await tx
        .update(userRestrictions)
        .set({ revokedAt: createdAt, revokedByUserId: createdByUserId })
        .where(
          and(
            eq(userRestrictions.userId, userId),
            isNull(userRestrictions.revokedAt),
          ),
        );

      const [row] = await tx
        .insert(userRestrictions)
        .values({
          userId,
          createdByUserId,
          createdAt,
          duration: input.duration,
          expiresAt,
          reasonCode: input.reasonCode,
          reasonDetail: input.reasonDetail?.trim() || null,
        })
        .returning();

      return row;
    });

    if (!created) throw new Error("user_restriction_create_failed");

    return {
      restrictionId: String(created.restrictionId),
      userId: String(created.userId),
      duration: created.duration as UserRestrictionResponse["duration"],
      reasonCode: created.reasonCode as UserRestrictionResponse["reasonCode"],
      reasonDetail: created.reasonDetail,
      expiresAt: created.expiresAt ? msToIso(created.expiresAt.valueOf()) : null,
      createdByUserId: String(created.createdByUserId),
      createdAt: msToIso(created.createdAt.valueOf()),
    };
  }
}
