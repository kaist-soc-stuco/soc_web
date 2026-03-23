import { Injectable } from "@nestjs/common";

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
  async findBySsoUserId(_ssoUserId: string): Promise<UserRecord | null> {
    throw new Error("TODO: users 테이블에서 sso_user_id 조회 구현");
  }

  async insert(
    _input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserRecord> {
    throw new Error("TODO: users 테이블 insert 구현");
  }

  async markConsent(_userId: string, _consentedAt: string): Promise<void> {
    throw new Error("TODO: privacy_consent_at 업데이트 구현");
  }
}
