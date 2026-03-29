import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { users } from "../../../infrastructure/postgres/postgres.schema";

import type { UserRecord } from "../entities/user";

/**
 * PostgreSQL users 테이블 접근 로직입니다.
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapRowToUserRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      permission: row.permission,
      privacyConsentAt: row.privacyConsentAt ? row.privacyConsentAt.toISOString() : null,
      ssoUserId: row.ssoUserId,
      updatedAt: row.updatedAt.toISOString(),
      userEmail: row.userEmail,
      userMobile: row.userMobile,
    };
  }

  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.ssoUserId, ssoUserId),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  async insert(
    input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserRecord> {
    const inserted = await this.db
      .insert(users)
      .values({
        permission: input.permission,
        privacyConsentAt: input.privacyConsentAt ? new Date(input.privacyConsentAt) : null,
        ssoUserId: input.ssoUserId,
        userEmail: input.userEmail,
        userMobile: input.userMobile,
      })
      .returning();

    return this.mapRowToUserRecord(inserted[0]);
  }

  async upsertConsentedUserBySso(input: {
    consentedAt: string;
    ssoUserId: string;
    userEmail?: string;
    userMobile?: string;
  }): Promise<UserRecord> {
    const upserted = await this.db
      .insert(users)
      .values({
        privacyConsentAt: new Date(input.consentedAt),
        ssoUserId: input.ssoUserId,
        userEmail: input.userEmail ?? null,
        userMobile: input.userMobile ?? null,
      })
      .onConflictDoUpdate({
        target: users.ssoUserId,
        set: {
          userEmail: sql`COALESCE(${users.userEmail}, excluded.user_email)`,
          userMobile: sql`COALESCE(${users.userMobile}, excluded.user_mobile)`,
          privacyConsentAt: sql`COALESCE(${users.privacyConsentAt}, excluded.privacy_consent_at)`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return this.mapRowToUserRecord(upserted[0]);
  }

  async markConsent(userId: string, consentedAt: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        privacyConsentAt: new Date(consentedAt),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateProfile(
    userId: string,
    input: {
      userEmail?: string;
      userMobile?: string;
    },
  ): Promise<void> {
    const updateSet: {
      updatedAt: Date;
      userEmail?: string | null;
      userMobile?: string | null;
    } = {
      updatedAt: new Date(),
    };

    if (input.userEmail !== undefined) {
      updateSet.userEmail = input.userEmail;
    }

    if (input.userMobile !== undefined) {
      updateSet.userMobile = input.userMobile;
    }

    await this.db.update(users).set(updateSet).where(eq(users.id, userId));
  }
}
