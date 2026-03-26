import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";

import { POSTGRES_POOL } from "../../../infrastructure/postgres/postgres.provider";

import type { UserRecord } from "../entities/user";

/**
 * PostgreSQL users 테이블 접근 골격입니다.
 *
 * TODO:
 * 1. 현재 프로젝트는 ORM이 없으므로 `pg` 기반 쿼리 또는 query helper를 선택하세요.
 * 2. 조회/삽입/동의 업데이트 쿼리를 먼저 나누세요.
 * 3. unique key는 `sso_user_id` 기준을 우선 검토하세요.
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  private mapRowToUserRecord(row: {
    id: string;
    permission: number;
    sso_user_id: string;
    user_email: string | null;
    user_mobile: string | null;
    privacy_consent_at: string | null;
    created_at: string;
    updated_at: string;
  }): UserRecord {
    return {
      createdAt: row.created_at,
      id: row.id,
      permission: row.permission,
      privacyConsentAt: row.privacy_consent_at,
      ssoUserId: row.sso_user_id,
      updatedAt: row.updated_at,
      userEmail: row.user_email,
      userMobile: row.user_mobile,
    };
  }

  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<{
      id: string;
      permission: number;
      sso_user_id: string;
      user_email: string | null;
      user_mobile: string | null;
      privacy_consent_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT id, permission, sso_user_id, user_email, user_mobile, privacy_consent_at, created_at, updated_at
        FROM users
        WHERE sso_user_id = $1
        LIMIT 1
      `,
      [ssoUserId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToUserRecord(result.rows[0]);
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<{
      id: string;
      permission: number;
      sso_user_id: string;
      user_email: string | null;
      user_mobile: string | null;
      privacy_consent_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT id, permission, sso_user_id, user_email, user_mobile, privacy_consent_at, created_at, updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToUserRecord(result.rows[0]);
  }

  async insert(
    input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserRecord> {
    const result = await this.pool.query<{
      id: string;
      permission: number;
      sso_user_id: string;
      user_email: string | null;
      user_mobile: string | null;
      privacy_consent_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
        INSERT INTO users (sso_user_id, user_email, user_mobile, privacy_consent_at, permission)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, permission, sso_user_id, user_email, user_mobile, privacy_consent_at, created_at, updated_at
      `,
      [
        input.ssoUserId,
        input.userEmail,
        input.userMobile,
        input.privacyConsentAt,
        input.permission,
      ],
    );

    return this.mapRowToUserRecord(result.rows[0]);
  }

  async upsertConsentedUserBySso(input: {
    consentedAt: string;
    ssoUserId: string;
    userEmail?: string;
    userMobile?: string;
  }): Promise<UserRecord> {
    const result = await this.pool.query<{
      id: string;
      permission: number;
      sso_user_id: string;
      user_email: string | null;
      user_mobile: string | null;
      privacy_consent_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
        INSERT INTO users (sso_user_id, user_email, user_mobile, privacy_consent_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sso_user_id)
        DO UPDATE SET
          user_email = COALESCE(users.user_email, EXCLUDED.user_email),
          user_mobile = COALESCE(users.user_mobile, EXCLUDED.user_mobile),
          privacy_consent_at = COALESCE(users.privacy_consent_at, EXCLUDED.privacy_consent_at),
          updated_at = NOW()
        RETURNING id, permission, sso_user_id, user_email, user_mobile, privacy_consent_at, created_at, updated_at
      `,
      [
        input.ssoUserId,
        input.userEmail ?? null,
        input.userMobile ?? null,
        input.consentedAt,
      ],
    );

    return this.mapRowToUserRecord(result.rows[0]);
  }

  async markConsent(userId: string, consentedAt: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE users
        SET privacy_consent_at = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, consentedAt],
    );
  }

  async updateProfile(
    userId: string,
    input: {
      userEmail?: string;
      userMobile?: string;
    },
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE users
        SET user_email = COALESCE($2, user_email),
            user_mobile = COALESCE($3, user_mobile),
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, input.userEmail ?? null, input.userMobile ?? null],
    );
  }
}
