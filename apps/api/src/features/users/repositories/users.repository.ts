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

  /** DB row를 서비스 계층에서 사용하는 UserRecord로 변환합니다. */
  private mapRowToUserRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      createdAt: row.createdAt.toISOString(),
      id: String(row.id),
      name: row.name,
      permission: row.permission,
      privacyConsentAt: row.privacyConsentAt
        ? row.privacyConsentAt.toISOString()
        : null,
      ssoUserId: row.ssoUserId,
      updatedAt: row.updatedAt.toISOString(),
      userEmail: row.userEmail,
      userMobile: row.userMobile,
    };
  }

  /** SSO 식별자로 users 레코드를 조회합니다. */
  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.ssoUserId, ssoUserId),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 내부 사용자 ID로 users 레코드를 조회합니다. */
  async findById(userId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: eq(users.id, Number(userId)),
    });

    return found ? this.mapRowToUserRecord(found) : null;
  }

  /** 신규 users 레코드를 생성하고 생성 결과를 반환합니다. */
  async insert(
    input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserRecord> {
    const inserted = await this.db
      .insert(users)
      .values({
        name: input.name,
        permission: input.permission,
        privacyConsentAt: input.privacyConsentAt
          ? new Date(input.privacyConsentAt)
          : null,
        ssoUserId: input.ssoUserId,
        userEmail: input.userEmail,
        userMobile: input.userMobile,
      })
      .returning();

    return this.mapRowToUserRecord(inserted[0]);
  }

  /** 동의 사용자 정보를 ssoUserId 기준으로 생성/갱신합니다. */
  async upsertConsentedUserBySso(input: {
    consentedAt: string;
    ssoUserId: string;
    name?: string;
    userEmail?: string;
    userMobile?: string;
  }): Promise<UserRecord> {
    const upserted = await this.db
      .insert(users)
      .values({
        name: input.name ?? null,
        privacyConsentAt: new Date(input.consentedAt),
        ssoUserId: input.ssoUserId,
        userEmail: input.userEmail ?? null,
        userMobile: input.userMobile ?? null,
      })
      .onConflictDoUpdate({
        target: users.ssoUserId,
        set: {
          name: sql`COALESCE(${users.name}, excluded.name)`,
          userEmail: sql`COALESCE(${users.userEmail}, excluded.user_email)`,
          userMobile: sql`COALESCE(${users.userMobile}, excluded.user_mobile)`,
          privacyConsentAt: sql`COALESCE(${users.privacyConsentAt}, excluded.privacy_consent_at)`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return this.mapRowToUserRecord(upserted[0]);
  }

  /** 개인정보 영구 저장 동의 시각을 기록합니다. */
  async markConsent(userId: string, consentedAt: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        privacyConsentAt: new Date(consentedAt),
        updatedAt: new Date(),
      })
      .where(eq(users.id, Number(userId)));
  }

  /** 이메일/휴대전화 필드만 선택적으로 갱신합니다. */
  async updateProfile(
    userId: string,
    input: {
      name?: string;
      userEmail?: string;
      userMobile?: string;
    },
  ): Promise<void> {
    const updateSet: {
      updatedAt: Date;
      name?: string | null;
      userEmail?: string | null;
      userMobile?: string | null;
    } = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateSet.name = input.name;
    }

    if (input.userEmail !== undefined) {
      updateSet.userEmail = input.userEmail;
    }

    if (input.userMobile !== undefined) {
      updateSet.userMobile = input.userMobile;
    }

    await this.db.update(users).set(updateSet).where(eq(users.id, Number(userId)));
  }
}
