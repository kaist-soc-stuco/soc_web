import { Injectable } from "@nestjs/common";

import type { UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";
import type { AdminUserRecord, StudentFeeStatusRecord, FeeStatus } from "@soc/contracts";
import { nowDate } from "@soc/shared";

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

  async upsertUserFromConsent(input: {
    kaistUid: string;
    nameEn?: string;
    nameKo: string;
    email: string;
    academicStatus?: string;
    departmentEn?: string;
    departmentKo?: string;
    identityCode?: string;
    stdNo?: string;
    userMobile?: string;
    consentedAt?: Date;
  }): Promise<UserRecord> {
    const now = nowDate();
    return this.usersRepository.upsertByKaistUid({
      academicStatus: input.academicStatus,
      departmentEn: input.departmentEn,
      departmentKo: input.departmentKo,
      kaistUid: input.kaistUid,
      identityCode: input.identityCode,
      nameEn: input.nameEn,
      nameKo: input.nameKo,
      stdNo: input.stdNo,
      email: input.email,
      lastLoginAt: now,
      privacyConsentAt: input.consentedAt ?? now,
    });
  }

  async resolvePermissionBitmaskByUserId(userId: string): Promise<number> {
    return this.usersRepository.resolvePermissionBitmaskByUserId(userId);
  }

  async searchUsers(input: { query?: string; limit?: number }): Promise<AdminUserRecord[]> {
    return this.usersRepository.searchUsers(input.query, input.limit ?? 20);
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

  async getStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord | null> {
    return this.usersRepository.getStudentFeeStatus(userId);
  }

  async updateStudentFeeStatus(
    userId: string,
    input: {
      status: FeeStatus;
      coverageSemesters?: number;
      note?: string | null;
      verifiedBy?: number;
    },
  ): Promise<StudentFeeStatusRecord> {
    return this.usersRepository.updateStudentFeeStatus(userId, input);
  }

  async ensureStudentFeeStatus(userId: string): Promise<StudentFeeStatusRecord> {
    return this.usersRepository.ensureStudentFeeStatus(userId);
  }

  async listStudentsByFeeStatus(
    status?: FeeStatus,
    page?: number,
    pageSize?: number,
  ): Promise<{ students: any[]; total: number; page: number; pageSize: number }> {
    return this.usersRepository.listStudentsByFeeStatus(status, page, pageSize);
  }
}
