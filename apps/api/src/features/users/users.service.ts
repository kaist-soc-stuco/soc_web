import { createHash } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminFeeListQuery,
  AdminFeeListResponse,
  AdminFeeUpdateResponse,
  AdminUserGetResponse,
  AdminUserListResponse,
  FeeSelfResponse,
  FeeStatus,
  FeeUpdateReasonCode,
  PatchMeRequest,
  UserMeResponse,
  UserProfile,
} from "@soc/contracts";

import type { EffectivePermissionGrant, UserRecord } from "./entities/user";
import { UsersRepository } from "./repositories/users.repository";

const ADMIN_USERS_PERMISSION = "USERS_MANAGE";
const ADMIN_FEES_PERMISSION = "FEES_MANAGE";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const FEE_UPDATE_REASONS = new Set<FeeUpdateReasonCode>(["PAYMENT_REVIEWED", "PAYMENT_CONFIRMED", "PAYMENT_NOT_FOUND", "DATA_CORRECTION"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEE_STATUSES = new Set<FeeStatus>(["UNKNOWN", "UNPAID", "PAID"]);
const isFeeStatus = (value: unknown): value is FeeStatus => typeof value === "string" && FEE_STATUSES.has(value as FeeStatus);
const isFeeUpdateReason = (value: unknown): value is FeeUpdateReasonCode => typeof value === "string" && FEE_UPDATE_REASONS.has(value as FeeUpdateReasonCode);
const auditCorrelationId = (requestId: string) =>
  createHash("sha256").update(requestId, "utf8").digest("hex");
const auditRequestFingerprint = (input: { actorUserId: string; feeStatus: FeeStatus; operatorNote?: string; reasonCode: FeeUpdateReasonCode; requestId: string; userId: string }) =>
  createHash("sha256").update(JSON.stringify([input.requestId, input.actorUserId, input.userId, input.feeStatus, input.reasonCode, input.operatorNote ?? null]), "utf8").digest("hex");
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private profile(user: UserRecord): UserProfile {
    return {
      feeStatus: user.feeStatus,
      id: user.id,
      kaistUid: user.kaistUid,
      majorMask: user.majorMask,
      nameEn: user.nameEn,
      nameKr: user.nameKr,
      privacyConsentAt: user.privacyConsentAt,
      studentOrEmployeeNumber: user.studentOrEmployeeNumber,
      studentOrEmployeeKind: user.studentOrEmployeeKind,
      userEmail: user.userEmail,
      userMobile: user.userMobile,
    };
  }
  private adminUserProfile(user: UserRecord): Omit<UserProfile, "feeStatus" | "userEmail" | "userMobile"> {
    return {
      id: user.id,
      kaistUid: user.kaistUid,
      majorMask: user.majorMask,
      nameEn: user.nameEn,
      nameKr: user.nameKr,
      privacyConsentAt: user.privacyConsentAt,
      studentOrEmployeeNumber: user.studentOrEmployeeNumber,
      studentOrEmployeeKind: user.studentOrEmployeeKind,
    };
  }

  private decodeCursor(cursor: string | undefined) {
    if (!cursor) return undefined;
    try {
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!value.createdAt || !value.id || Number.isNaN(Date.parse(value.createdAt)) || !UUID_PATTERN.test(value.id)) throw new Error();
      return { createdAt: value.createdAt, id: value.id };
    } catch {
      throw new BadRequestException("invalid_cursor");
    }
  }

  private encodeCursor(user: UserRecord): string {
    return Buffer.from(JSON.stringify({ createdAt: user.createdAt, id: user.id })).toString("base64url");
  }

  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    return this.usersRepository.findBySsoUserId(ssoUserId);
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(userId);
  }

  async synchronizeAuthoritativeSsoProfile(input: {
    consentedAt?: string;
    kaistUid: string;
    nameEn: string;
    nameKr: string;
    ssoSubject: string;
    studentOrEmployeeKind: "STUDENT" | "EMPLOYEE";
    studentOrEmployeeNumber: string;
    userEmail: string;
  }): Promise<UserRecord> {
    return this.usersRepository.synchronizeAuthoritativeSsoProfile(input);
  }
  async ensureCanonicalSsoSubject(
    userId: string,
    ssoSubject: string,
  ): Promise<void> {
    await this.usersRepository.setCanonicalSsoSubjectIfMissing(userId, ssoSubject);
  }

  async createFromSsoUser(input: { consentedAt?: string; ssoUserId: string; userEmail?: string; userMobile?: string }): Promise<UserRecord> {
    return this.usersRepository.insert({ privacyConsentAt: input.consentedAt ?? null, ssoUserId: input.ssoUserId, userEmail: input.userEmail ?? null, userMobile: input.userMobile ?? null });
  }

  async upsertConsentedSsoUser(input: { consentedAt: string; ssoUserId: string; userEmail?: string; userMobile?: string }): Promise<UserRecord> {
    return this.usersRepository.upsertConsentedUserBySso(input);
  }

  async hasPersistedProfile(userId: string): Promise<boolean> {
    return Boolean((await this.usersRepository.findById(userId))?.privacyConsentAt);
  }
  async grantAllDevelopmentPermissions(userId: string): Promise<void> {
    await this.usersRepository.grantAllActivePermissions(userId);
  }

  async markConsent(userId: string, consentedAt: string): Promise<void> {
    const updated = await this.usersRepository.updateProfile(userId, { privacyConsentAt: consentedAt });
    if (!updated) throw new NotFoundException("user_not_found");
  }

  async updateProfileFromSso(userId: string, input: { userEmail?: string; userMobile?: string }): Promise<void> {
    const updated = await this.usersRepository.updateProfile(userId, input);
    if (!updated) throw new NotFoundException("user_not_found");
  }

  async getMe(userId: string): Promise<UserMeResponse> {
    const user = await this.requireUser(userId);
    return { ...this.profile(user), grants: (await this.usersRepository.findEffectiveGrants([userId])).get(userId) ?? [] };
  }

  async patchMe(userId: string, input: PatchMeRequest): Promise<UserMeResponse> {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("invalid_profile_update");
    }
    for (const value of [input.userMobile]) {
      if (value !== undefined && value !== null && (typeof value !== "string" || value.length > 320)) {
        throw new BadRequestException("invalid_profile_update");
      }
    }
    const updated = await this.usersRepository.updateProfile(userId, {
      userMobile: input.userMobile,
    });
    if (!updated) throw new NotFoundException("user_not_found");
    return { ...this.profile(updated), grants: (await this.usersRepository.findEffectiveGrants([userId])).get(userId) ?? [] };
  }

  async requireAdminUsers(actorUserId: string): Promise<void> {
    await this.requireEffectiveGrant(actorUserId, ADMIN_USERS_PERMISSION);
  }

  async requireAdminFees(actorUserId: string): Promise<void> {
    await this.requireEffectiveGrant(actorUserId, ADMIN_FEES_PERMISSION);
  }

  async listAdmin(actorUserId: string, query: { cursor?: string; feeStatus?: FeeStatus; limit?: number; name?: string; studentOrEmployeeNumber?: string }): Promise<AdminUserListResponse> {
    await this.requireAdminUsers(actorUserId);
    if (query.feeStatus !== undefined) {
      if (!FEE_STATUSES.has(query.feeStatus)) throw new BadRequestException("invalid_fee_status");
      await this.requireAdminFees(actorUserId);
    }
    const requestedLimit = Number(query.limit ?? DEFAULT_PAGE_SIZE);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const rows = await this.usersRepository.list({ ...query, cursor: this.decodeCursor(query.cursor), limit: limit + 1 });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const grants = await this.usersRepository.findEffectiveGrants(items.map((user) => user.id));
    return {
      items: items.map((user) => ({ ...this.adminUserProfile(user), grants: grants.get(user.id) ?? [] })),
      nextCursor: hasMore ? this.encodeCursor(items.at(-1)!) : null,
    };
  }
  async listAdminFees(actorUserId: string, query: AdminFeeListQuery): Promise<AdminFeeListResponse> {
    await this.requireAdminFees(actorUserId);
    if (query.feeStatus !== undefined && !FEE_STATUSES.has(query.feeStatus)) throw new BadRequestException("invalid_fee_status");
    const requestedLimit = Number(query.limit ?? DEFAULT_PAGE_SIZE);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const rows = await this.usersRepository.list({ ...query, cursor: this.decodeCursor(query.cursor), limit: limit + 1 });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return {
      items: items.map((user) => ({
        feeStatus: user.feeStatus,
        id: user.id,
        nameEn: user.nameEn,
        nameKr: user.nameKr,
        studentOrEmployeeKind: user.studentOrEmployeeKind,
        studentOrEmployeeNumber: user.studentOrEmployeeNumber,
        updatedAt: user.updatedAt,
      })),
      nextCursor: hasMore ? this.encodeCursor(items.at(-1)!) : null,
    };
  }

  async getAdmin(actorUserId: string, userId: string): Promise<AdminUserGetResponse> {
    await this.requireAdminUsers(actorUserId);
    const user = await this.requireUser(userId);
    return {
      ...this.adminUserProfile(user),
      grants: (await this.usersRepository.findEffectiveGrants([userId])).get(userId) ?? [],
    };
  }

  async getFeeSelf(userId: string): Promise<FeeSelfResponse> {
    return { feeStatus: (await this.requireUser(userId)).feeStatus };
  }

  async updateFeeAdmin(actorUserId: string, userId: string, input: { feeStatus: unknown; operatorNote?: unknown; reasonCode: unknown }, requestId: string): Promise<AdminFeeUpdateResponse> {
    await this.requireAdminFees(actorUserId);
    if (
      !input
      || !isFeeStatus(input.feeStatus)
      || !isFeeUpdateReason(input.reasonCode)
      || (input.operatorNote !== undefined && (typeof input.operatorNote !== "string" || !input.operatorNote.trim() || input.operatorNote.length > 500))
      || !REQUEST_ID_PATTERN.test(requestId)
    ) throw new ForbiddenException("fee_update_audit_metadata_required");
    const result = await this.usersRepository.updateFeeWithAudit({
      actorUserId,
      feeStatus: input.feeStatus,
      reasonCode: input.reasonCode,
      requestId: auditCorrelationId(requestId),
      requestFingerprint: auditRequestFingerprint({ actorUserId, feeStatus: input.feeStatus, operatorNote: input.operatorNote as string | undefined, reasonCode: input.reasonCode, requestId, userId }),
      userId,
    });
    if (result === "forbidden") throw new ForbiddenException("insufficient_permission");
    if (result === "conflict") throw new ConflictException("fee_update_idempotency_conflict");
    if (!result) throw new NotFoundException("user_not_found");
    return { feeStatus: result.feeStatus, updatedAt: result.updatedAt, userId: result.id };
  }

  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException("user_not_found");
    return user;
  }

  private async requireEffectiveGrant(userId: string, permission: string): Promise<void> {
    const grants: EffectivePermissionGrant[] = (await this.usersRepository.findEffectiveGrants([userId])).get(userId) ?? [];
    if (!grants.some((grant) => grant.permission === permission && grant.scope === "GLOBAL")) throw new ForbiddenException("insufficient_permission");
  }
}
