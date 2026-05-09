import { Injectable } from "@nestjs/common";

import type { UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";

/**
 * PostgreSQL user 저장/조회 로직을 담당합니다.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * KAIST UID로 저장된 사용자를 조회합니다.
   */
  async findByKaistUid(kaistUid: string): Promise<UserRecord | null> {
    return this.usersRepository.findByKaistUid(kaistUid);
  }

  /** 내부 사용자 ID로 사용자를 조회합니다. */
  async findById(userId: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(userId);
  }

  /**
   * SSO userInfo를 바탕으로 새 사용자를 저장합니다.
   */
  async createFromSsoUser(input: {
    kaistUid: string;
    nameEn?: string;
    nameKo: string;
    ssoSubject: string;
    email: string;
    academicStatus?: string | null;
    departmentEn?: string | null;
    departmentKo?: string | null;
    identityCode?: string | null;
    isActive?: boolean;
    lastLoginAt?: Date;
    stdNo?: string | null;
  }): Promise<UserRecord> {
    return this.usersRepository.insert({
      academicStatus: input.academicStatus ?? null,
      kaistUid: input.kaistUid,
      nameEn: input.nameEn ?? null,
      nameKo: input.nameKo,
      ssoSubject: input.ssoSubject,
      stdNo: input.stdNo ?? null,
      departmentEn: input.departmentEn ?? null,
      departmentKo: input.departmentKo ?? null,
      email: input.email,
      identityCode: input.identityCode ?? null,
      isActive: input.isActive,
      lastLoginAt: input.lastLoginAt,
    });
  }

  async upsertUserFromConsent(input: {
    kaistUid: string;
    nameEn?: string;
    nameKo: string;
    ssoSubject: string;
    email: string;
    academicStatus?: string;
    departmentEn?: string;
    departmentKo?: string;
    identityCode?: string;
    stdNo?: string;
    userMobile?: string;
    consentedAt?: Date;
  }): Promise<UserRecord> {
    return this.usersRepository.upsertByKaistUid({
      academicStatus: input.academicStatus,
      departmentEn: input.departmentEn,
      departmentKo: input.departmentKo,
      kaistUid: input.kaistUid,
      identityCode: input.identityCode,
      nameEn: input.nameEn,
      nameKo: input.nameKo,
      ssoSubject: input.ssoSubject,
      stdNo: input.stdNo,
      email: input.email,
      lastLoginAt: new Date(),
      privacyConsentAt: input.consentedAt ?? new Date(),
    });
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    return this.usersRepository.resolvePermissionBitmaskByUserId(userId);
  }

  /**
   * 현재 사용자가 개인정보를 영구 저장한 상태인지 확인합니다.
   */
  async hasPersistedProfile(userId: string): Promise<boolean> {
    const foundByInternalId = await this.usersRepository.findById(userId);
    return Boolean(foundByInternalId?.isActive);
  }

  /** SSO 최신 정보로 프로필을 부분 갱신합니다. */
  async updateProfileFromSso(
    userId: string,
    input: {
      academicStatus?: string;
      departmentEn?: string;
      departmentKo?: string;
      email?: string;
      identityCode?: string;
      nameEn?: string;
      nameKo?: string;
      stdNo?: string;
    },
  ): Promise<void> {
    await this.usersRepository.updateProfile(userId, input);
  }
}
