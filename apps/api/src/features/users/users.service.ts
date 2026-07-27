import { createHash } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminFeeUpdateResponse,
  AdminUserGetResponse,
  AdminUserListResponse,
  FeeSelfResponse,
  FeeStatus,
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

const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const FEE_STATUSES = new Set<FeeStatus>(["UNKNOWN", "UNPAID", "PAID"]);
const isFeeStatus = (value: unknown): value is FeeStatus => typeof value === "string" && FEE_STATUSES.has(value as FeeStatus);
const auditCorrelationId = (requestId: string) =>
  createHash("sha256").update(requestId, "utf8").digest("hex");
const auditRequestFingerprint = (input: { actorUserId: string; feeStatus: FeeStatus; reasonCode: string; requestId: string; userId: string }) =>
  createHash("sha256").update(JSON.stringify([input.requestId, input.actorUserId, input.userId, input.feeStatus, input.reasonCode]), "utf8").digest("hex");
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
    };
  }

  private decodeCursor(cursor: string | undefined) {
    if (!cursor) return undefined;
    try {
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!value.createdAt || !value.id || Number.isNaN(Date.parse(value.createdAt)) || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id)) throw new Error();
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
    for (const value of [input.userEmail, input.userMobile]) {
      if (value !== undefined && value !== null && (typeof value !== "string" || value.length > 320)) {
        throw new BadRequestException("invalid_profile_update");
      }
    }
    const updated = await this.usersRepository.updateProfile(userId, {
      userEmail: input.userEmail,
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

  async listAdmin(actorUserId: string, query: { cursor?: string; feeStatus?: FeeStatus; kaistUid?: string; limit?: number; studentOrEmployeeNumber?: string }): Promise<AdminUserListResponse> {
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

  async updateFeeAdmin(actorUserId: string, userId: string, input: { feeStatus: unknown; reasonCode: unknown }, requestId: string): Promise<AdminFeeUpdateResponse> {
    await this.requireAdminFees(actorUserId);
    if (
      !input
      || !isFeeStatus(input.feeStatus)
      || typeof input.reasonCode !== "string"
      || !REASON_CODE_PATTERN.test(input.reasonCode)
      || !REQUEST_ID_PATTERN.test(requestId)
    ) throw new ForbiddenException("fee_update_audit_metadata_required");
    const result = await this.usersRepository.updateFeeWithAudit({
      actorUserId,
      feeStatus: input.feeStatus,
      reasonCode: input.reasonCode,
      requestId: auditCorrelationId(requestId),
      requestFingerprint: auditRequestFingerprint({ actorUserId, feeStatus: input.feeStatus, reasonCode: input.reasonCode, requestId, userId }),
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
