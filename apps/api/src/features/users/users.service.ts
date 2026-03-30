import { Injectable } from "@nestjs/common";

import type { UserRecord } from './entities/user';
import { UsersRepository } from './repositories/users.repository';

/**
 * PostgreSQL user 저장/조회 로직을 담당합니다.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * SSO 식별자로 저장된 사용자를 조회합니다.
   */
  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    return this.usersRepository.findBySsoUserId(ssoUserId);
  }

  /** 내부 사용자 ID로 사용자를 조회합니다. */
  async findById(userId: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(userId);
  }

  /**
   * SSO userInfo를 바탕으로 새 사용자를 저장합니다.
   */
  async createFromSsoUser(input: {
    ssoUserId: string;
    userEmail?: string;
    userMobile?: string;
    consentedAt?: string;
  }): Promise<UserRecord> {
    return this.usersRepository.insert({
      permission: 0,
      privacyConsentAt: input.consentedAt ?? null,
      ssoUserId: input.ssoUserId,
      userEmail: input.userEmail ?? null,
      userMobile: input.userMobile ?? null,
    });
  }

  async upsertConsentedSsoUser(input: {
    consentedAt: string;
    ssoUserId: string;
    userEmail?: string;
    userMobile?: string;
  }): Promise<UserRecord> {
    return this.usersRepository.upsertConsentedUserBySso(input);
  }

  /**
   * 현재 사용자가 개인정보를 영구 저장한 상태인지 확인합니다.
   */
  async hasPersistedProfile(userId: string): Promise<boolean> {
    const foundByInternalId = await this.usersRepository.findById(userId);
    return Boolean(foundByInternalId?.privacyConsentAt);
  }

  async markConsent(userId: string, consentedAt: string): Promise<void> {
    await this.usersRepository.markConsent(userId, consentedAt);
  }

  /** SSO 최신 정보로 이메일/휴대전화 프로필을 부분 갱신합니다. */
  async updateProfileFromSso(
    userId: string,
    input: {
      userEmail?: string;
      userMobile?: string;
    },
  ): Promise<void> {
    await this.usersRepository.updateProfile(userId, input);
  }
}
