import { Injectable } from "@nestjs/common";

import type { UserRecord } from './entities/user';
import { UsersRepository } from './repositories/users.repository';

/**
 * PostgreSQL user 저장/조회 로직 골격입니다.
 *
 * TODO:
 * 1. SSO userInfo -> UserRecord 매핑 규칙을 먼저 확정하세요.
 * 2. find/create/hasPersistedProfile 순서로 구현하세요.
 * 3. 동의 여부 판단을 `privacyConsentAt` 기준으로 할지 별도 boolean으로 할지 팀에서 결정하세요.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * SSO 식별자로 저장된 사용자를 조회합니다.
   */
  async findBySsoUserId(_ssoUserId: string): Promise<UserRecord | null> {
    void this.usersRepository;
    throw new Error("TODO: PostgreSQL user 조회 구현");
  }

  /**
   * SSO userInfo를 바탕으로 새 사용자를 저장합니다.
   */
  async createFromSsoUser(_input: {
    ssoUserId: string;
    userEmail?: string;
    userMobile?: string;
  }): Promise<UserRecord> {
    void this.usersRepository;
    throw new Error("TODO: PostgreSQL user 생성 구현");
  }

  /**
   * 현재 사용자가 개인정보를 영구 저장한 상태인지 확인합니다.
   */
  async hasPersistedProfile(_userId: string): Promise<boolean> {
    void this.usersRepository;
    throw new Error("TODO: persisted profile 여부 확인 구현");
  }
}
