import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  permissionAuditLog,
  permissionDefinitions,
  permissionGrants,
  users,
} from "../../../infrastructure/postgres/postgres.schema";
import { PiiCipherService } from "../../../shared/security/pii-cipher.service";
import type { EffectivePermissionGrant, UserRecord } from "../entities/user";

export interface UserCursor {
  createdAt: string;
  id: string;
}
const PII_FIELDS = {
  kaistUid: "users.kaist_uid",
  studentOrEmployeeNumber: "users.student_or_employee_number",
  nameKr: "users.name_kr",
  nameEn: "users.name_en",
  userEmail: "users.user_email",
  userMobile: "users.user_mobile",
} as const;

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    private readonly piiCipher: PiiCipherService,
  ) {}

  private mapRowToUserRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      createdAt: row.createdAt.toISOString(),
      feeStatus: row.feeStatus,
      id: row.id,
      kaistUid: this.piiCipher.decrypt(PII_FIELDS.kaistUid, row.kaistUid),
      majorMask: row.majorMask,
      nameEn: this.piiCipher.decrypt(PII_FIELDS.nameEn, row.nameEn),
      nameKr: this.piiCipher.decrypt(PII_FIELDS.nameKr, row.nameKr),
      privacyConsentAt: row.privacyConsentAt?.toISOString() ?? null,
      ssoSubject: row.ssoSubject,
      ssoUserId: row.ssoUserId,
      studentOrEmployeeNumber: this.piiCipher.decrypt(
        PII_FIELDS.studentOrEmployeeNumber,
        row.studentOrEmployeeNumber,
      ),
      updatedAt: row.updatedAt.toISOString(),
      userEmail: this.piiCipher.decrypt(PII_FIELDS.userEmail, row.userEmail),
      userMobile: this.piiCipher.decrypt(PII_FIELDS.userMobile, row.userMobile),
    };
  }

  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({ where: eq(users.ssoUserId, ssoUserId) });
    return found ? this.mapRowToUserRecord(found) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    return found ? this.mapRowToUserRecord(found) : null;
  }
  async setCanonicalSsoSubjectIfMissing(
    userId: string,
    ssoSubject: string,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        ssoSubject: sql`COALESCE(${users.ssoSubject}, ${ssoSubject})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async list(input: {
    cursor?: UserCursor;
    feeStatus?: UserRecord["feeStatus"];
    kaistUid?: string;
    limit: number;
    studentOrEmployeeNumber?: string;
  }): Promise<UserRecord[]> {
    const predicates: SQL[] = [];
    if (input.kaistUid) predicates.push(inArray(users.kaistUid, this.piiCipher.encryptForLookup(PII_FIELDS.kaistUid, input.kaistUid)));
    if (input.studentOrEmployeeNumber) predicates.push(inArray(users.studentOrEmployeeNumber, this.piiCipher.encryptForLookup(PII_FIELDS.studentOrEmployeeNumber, input.studentOrEmployeeNumber)));
    if (input.feeStatus) predicates.push(eq(users.feeStatus, input.feeStatus));
    if (input.cursor) {
      const createdAt = new Date(input.cursor.createdAt);
      predicates.push(or(gt(users.createdAt, createdAt), and(eq(users.createdAt, createdAt), gt(users.id, input.cursor.id)))!);
    }
    const rows = await this.db.select().from(users).where(predicates.length ? and(...predicates) : undefined).orderBy(asc(users.createdAt), asc(users.id)).limit(input.limit);
    return rows.map((row) => this.mapRowToUserRecord(row));
  }

  async findEffectiveGrants(userIds: string[]): Promise<Map<string, EffectivePermissionGrant[]>> {
    const result = new Map<string, EffectivePermissionGrant[]>();
    if (!userIds.length) return result;
    const rows = await this.db
      .select({ grant: permissionGrants, permission: permissionDefinitions.key })
      .from(permissionGrants)
      .innerJoin(permissionDefinitions, eq(permissionGrants.permissionDefinitionId, permissionDefinitions.id))
      .where(and(inArray(permissionGrants.userId, userIds), isNull(permissionGrants.revokedAt), sql`${permissionGrants.activatedFrom} <= now()`, or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, sql`now()`)), eq(permissionDefinitions.isActive, true)));
    for (const { grant, permission } of rows) {
      const grants = result.get(grant.userId) ?? [];
      grants.push({ activatedFrom: grant.activatedFrom.toISOString(), expiresAt: grant.expiresAt?.toISOString() ?? null, id: grant.id, permission, scope: grant.scope, scopeId: grant.scopeId });
      result.set(grant.userId, grants);
    }
    return result;
  }

  async insert(input: {
    privacyConsentAt: string | null;
    ssoUserId: string;
    userEmail: string | null;
    userMobile: string | null;
  }): Promise<UserRecord> {
    const [inserted] = await this.db.insert(users).values({
      privacyConsentAt: input.privacyConsentAt ? new Date(input.privacyConsentAt) : null,
      ssoSubject: input.ssoUserId,
      ssoUserId: input.ssoUserId,
      userEmail: this.piiCipher.encrypt(PII_FIELDS.userEmail, input.userEmail),
      userMobile: this.piiCipher.encrypt(PII_FIELDS.userMobile, input.userMobile),
    }).returning();
    return this.mapRowToUserRecord(inserted);
  }

  async upsertConsentedUserBySso(input: { consentedAt: string; ssoUserId: string; userEmail?: string; userMobile?: string }): Promise<UserRecord> {
    const encryptedEmail = this.piiCipher.encrypt(PII_FIELDS.userEmail, input.userEmail ?? null);
    const encryptedMobile = this.piiCipher.encrypt(PII_FIELDS.userMobile, input.userMobile ?? null);
    const [upserted] = await this.db.insert(users).values({
      privacyConsentAt: new Date(input.consentedAt),
      ssoSubject: input.ssoUserId,
      ssoUserId: input.ssoUserId,
      userEmail: encryptedEmail,
      userMobile: encryptedMobile,
    }).onConflictDoUpdate({
      target: users.ssoUserId,
      set: {
        ssoSubject: sql`COALESCE(${users.ssoSubject}, excluded.sso_subject)`,
        userEmail: sql`COALESCE(${users.userEmail}, excluded.user_email)`,
        userMobile: sql`COALESCE(${users.userMobile}, excluded.user_mobile)`,
        privacyConsentAt: sql`COALESCE(${users.privacyConsentAt}, excluded.privacy_consent_at)`,
        updatedAt: sql`NOW()`,
      },
    }).returning();
    return this.mapRowToUserRecord(upserted);
  }

  async updateProfile(userId: string, input: { privacyConsentAt?: string | null; userEmail?: string | null; userMobile?: string | null }): Promise<UserRecord | null> {
    const [updated] = await this.db.update(users).set({
      privacyConsentAt: input.privacyConsentAt === undefined
        ? undefined
        : input.privacyConsentAt
          ? new Date(input.privacyConsentAt)
          : null,
      userEmail: input.userEmail === undefined
        ? undefined
        : this.piiCipher.encrypt(PII_FIELDS.userEmail, input.userEmail),
      userMobile: input.userMobile === undefined
        ? undefined
        : this.piiCipher.encrypt(PII_FIELDS.userMobile, input.userMobile),
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return updated ? this.mapRowToUserRecord(updated) : null;
  }

  async updateFeeWithAudit(input: {
    actorUserId: string;
    feeStatus: UserRecord["feeStatus"];
    reasonCode: string;
    requestId: string;
    userId: string;
  }): Promise<UserRecord | "conflict" | "forbidden" | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.requestId}))`);

      const authority = await tx.execute(sql`
        SELECT grant_record.id
        FROM permission_grants grant_record
        INNER JOIN permission_definitions definition
          ON definition.id = grant_record.permission_definition_id
        WHERE grant_record.user_id = ${input.actorUserId}
          AND definition.key = 'FEES_MANAGE'
          AND definition.is_active = true
          AND grant_record.scope = 'GLOBAL'
          AND grant_record.revoked_at IS NULL
          AND grant_record.activated_from <= now()
          AND (grant_record.expires_at IS NULL OR grant_record.expires_at > now())
        FOR UPDATE OF grant_record
      `);
      if (authority.rows.length === 0) return "forbidden";

      const [existingAudit] = await tx
        .select({ recordId: permissionAuditLog.recordId })
        .from(permissionAuditLog)
        .where(and(
          eq(permissionAuditLog.action, "FEE_STATUS_UPDATED"),
          eq(permissionAuditLog.actorUserId, input.actorUserId),
          eq(permissionAuditLog.correlationId, input.requestId),
        ))
        .limit(1);
      if (existingAudit) {
        if (existingAudit.recordId !== input.userId) return "forbidden";
        const [existingUser] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
        if (!existingUser) return null;
        return existingUser.feeStatus === input.feeStatus
          ? this.mapRowToUserRecord(existingUser)
          : "conflict";
      }

      const [updated] = await tx
        .update(users)
        .set({ feeStatus: input.feeStatus, updatedAt: sql`now()` })
        .where(eq(users.id, input.userId))
        .returning();
      if (!updated) return null;
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: "FEE_STATUS_UPDATED",
        changedFieldNames: "feeStatus",
        correlationId: input.requestId,
        reasonCode: input.reasonCode,
        recordId: updated.id,
      });
      return this.mapRowToUserRecord(updated);
    });
  }
}
