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
  userPiiBackfillProgress,
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

  private decryptPii(field: string, value: string | null): string | null {
    return value === null || !this.piiCipher.looksLikeEnvelope(value)
      ? value
      : this.piiCipher.decrypt(field, value);
  }

  private mapRowToUserRecord(row: typeof users.$inferSelect): UserRecord {
    return {
      createdAt: row.createdAt.toISOString(),
      feeStatus: row.feeStatus,
      id: row.id,
      kaistUid: this.decryptPii(PII_FIELDS.kaistUid, row.kaistUid),
      majorMask: row.majorMask,
      nameEn: this.decryptPii(PII_FIELDS.nameEn, row.nameEn),
      nameKr: this.decryptPii(PII_FIELDS.nameKr, row.nameKr),
      privacyConsentAt: row.privacyConsentAt?.toISOString() ?? null,
      ssoSubject: row.ssoSubject,
      ssoUserId: row.ssoUserId,
      studentOrEmployeeNumber: this.decryptPii(
        PII_FIELDS.studentOrEmployeeNumber,
        row.studentOrEmployeeNumber,
      ),
      studentOrEmployeeKind: row.studentOrEmployeeKind as UserRecord["studentOrEmployeeKind"],
      updatedAt: row.updatedAt.toISOString(),
      userEmail: this.decryptPii(PII_FIELDS.userEmail, row.userEmail),
      userMobile: this.decryptPii(PII_FIELDS.userMobile, row.userMobile),
    };
  }

  async findBySsoUserId(ssoUserId: string): Promise<UserRecord | null> {
    const found = await this.db.query.users.findFirst({
      where: or(eq(users.ssoSubject, ssoUserId), eq(users.ssoUserId, ssoUserId)),
    });
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
    limit: number;
    name?: string;
    studentOrEmployeeNumber?: string;
  }): Promise<UserRecord[]> {
    const predicates: SQL[] = [];
    if (input.name) predicates.push(or(
      inArray(users.nameKr, this.piiCipher.encryptForLookup(PII_FIELDS.nameKr, input.name)),
      inArray(users.nameEn, this.piiCipher.encryptForLookup(PII_FIELDS.nameEn, input.name)),
    )!);
    if (input.studentOrEmployeeNumber) predicates.push(inArray(users.studentOrEmployeeNumber, this.piiCipher.encryptForLookup(PII_FIELDS.studentOrEmployeeNumber, input.studentOrEmployeeNumber)));
    if (input.feeStatus) predicates.push(eq(users.feeStatus, input.feeStatus));
    if (input.cursor) {
      const createdAt = new Date(input.cursor.createdAt);
      predicates.push(or(gt(users.createdAt, createdAt), and(eq(users.createdAt, createdAt), gt(users.id, input.cursor.id)))!);
    }
    const rows = await this.db.select().from(users).where(predicates.length ? and(...predicates) : undefined).orderBy(asc(users.createdAt), asc(users.id)).limit(input.limit);
    return rows.map((row) => this.mapRowToUserRecord(row));
  }
  async listCurrentFees(): Promise<UserRecord[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.updatedAt), asc(users.id));
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
  async grantAllActivePermissions(userId: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO permission_grants (
        user_id,
        permission_definition_id,
        scope,
        scope_id,
        granted_by_user_id
      )
      SELECT
        ${userId}::uuid,
        definition.id,
        'GLOBAL'::permission_grant_scope,
        NULL,
        ${userId}::uuid
      FROM permission_definitions AS definition
      WHERE definition.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM permission_grants AS existing
          WHERE existing.user_id = ${userId}::uuid
            AND existing.permission_definition_id = definition.id
            AND existing.scope = 'GLOBAL'::permission_grant_scope
            AND existing.scope_id IS NULL
            AND existing.revoked_at IS NULL
        )
    `);
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

  async synchronizeAuthoritativeSsoProfile(input: {
    consentedAt?: string;
    kaistUid: string;
    nameEn: string;
    nameKr: string;
    ssoSubject: string;
    studentOrEmployeeKind: UserRecord["studentOrEmployeeKind"];
    studentOrEmployeeNumber: string;
    userEmail: string;
  }): Promise<UserRecord> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.ssoSubject}))`);
      const [bySubject] = await tx.select().from(users).where(
        or(eq(users.ssoSubject, input.ssoSubject), eq(users.ssoUserId, input.ssoSubject)),
      ).limit(1);
      const [byKaistUid] = await tx.select().from(users).where(
        inArray(users.kaistUid, this.piiCipher.encryptForLookup(PII_FIELDS.kaistUid, input.kaistUid)),
      ).limit(1);
      if (byKaistUid && (!bySubject || byKaistUid.id !== bySubject.id)) {
        throw new Error("sso_identity_conflict");
      }
      const values = {
        privacyConsentAt: input.consentedAt ? new Date(input.consentedAt) : undefined,
        kaistUid: this.piiCipher.encrypt(PII_FIELDS.kaistUid, input.kaistUid),
        nameEn: this.piiCipher.encrypt(PII_FIELDS.nameEn, input.nameEn),
        nameKr: this.piiCipher.encrypt(PII_FIELDS.nameKr, input.nameKr),
        ssoSubject: input.ssoSubject,
        studentOrEmployeeKind: input.studentOrEmployeeKind,
        studentOrEmployeeNumber: this.piiCipher.encrypt(
          PII_FIELDS.studentOrEmployeeNumber,
          input.studentOrEmployeeNumber,
        ),
        userEmail: this.piiCipher.encrypt(PII_FIELDS.userEmail, input.userEmail),
        updatedAt: new Date(),
      };
      if (bySubject) {
        const [updated] = await tx.update(users).set(values).where(eq(users.id, bySubject.id)).returning();
        return this.mapRowToUserRecord(updated);
      }
      const [inserted] = await tx.insert(users).values({
        ...values,
        ssoUserId: input.ssoSubject,
      }).returning();
      return this.mapRowToUserRecord(inserted);
    });
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

  async updateSelfMobile(userId: string, userMobile: string | null | undefined): Promise<UserRecord | null> {
    const [updated] = await this.db.update(users).set({
      userMobile: userMobile === undefined
        ? undefined
        : this.piiCipher.encrypt(PII_FIELDS.userMobile, userMobile),
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return updated ? this.mapRowToUserRecord(updated) : null;
  }

  async updatePrivacyConsent(userId: string, privacyConsentAt: string | null): Promise<UserRecord | null> {
    const [updated] = await this.db.update(users).set({
      privacyConsentAt: privacyConsentAt ? new Date(privacyConsentAt) : null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return updated ? this.mapRowToUserRecord(updated) : null;
  }

  async updateFeeWithAudit(input: {
    actorUserId: string;
    feeStatus: UserRecord["feeStatus"];
    reasonCode: string;
    requestId: string;
    requestFingerprint: string;
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
        .select({ recordId: permissionAuditLog.recordId, requestFingerprint: permissionAuditLog.requestFingerprint })
        .from(permissionAuditLog)
        .where(and(
          eq(permissionAuditLog.action, "FEE_STATUS_UPDATED"),
          eq(permissionAuditLog.correlationId, input.requestId),
        ))
        .limit(1);
      if (existingAudit) {
        if (existingAudit.requestFingerprint !== input.requestFingerprint) return "conflict";
        const [existingUser] = await tx.select().from(users).where(eq(users.id, existingAudit.recordId)).for("update");
        if (!existingUser) return null;
        return this.mapRowToUserRecord(existingUser);
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
        requestFingerprint: input.requestFingerprint,
        recordId: updated.id,
      }).onConflictDoNothing();
      const [recordedAudit] = await tx.select({ recordId: permissionAuditLog.recordId, requestFingerprint: permissionAuditLog.requestFingerprint })
        .from(permissionAuditLog)
        .where(and(eq(permissionAuditLog.action, "FEE_STATUS_UPDATED"), eq(permissionAuditLog.correlationId, input.requestId)))
        .limit(1);
      if (!recordedAudit || recordedAudit.requestFingerprint !== input.requestFingerprint) return "conflict";
      if (recordedAudit.recordId !== updated.id) {
        const [recordedUser] = await tx.select().from(users).where(eq(users.id, recordedAudit.recordId));
        return recordedUser ? this.mapRowToUserRecord(recordedUser) : null;
      }
      return this.mapRowToUserRecord(updated);
    });
  }
  async backfillLegacyPii(input: { cursor?: UserCursor; limit: number }): Promise<{ processed: number; cursor: UserCursor | null }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('user_pii_backfill'))`);
      let [progress] = await tx.select().from(userPiiBackfillProgress)
        .where(eq(userPiiBackfillProgress.jobKey, "users"))
        .for("update").limit(1);
      if (!progress) {
        const [upper] = await tx.select({ createdAt: users.createdAt, id: users.id })
          .from(users).orderBy(sql`${users.createdAt} DESC`, sql`${users.id} DESC`).limit(1);
        [progress] = await tx.insert(userPiiBackfillProgress).values({
          jobKey: "users",
          batchSize: input.limit,
          upperBoundCreatedAt: upper?.createdAt ?? null,
          upperBoundUserId: upper?.id ?? null,
        }).returning();
      }
      if (progress.completedAt) return { processed: 0, cursor: null };
      const predicates: SQL[] = [];
      if (progress.lastProcessedCreatedAt && progress.lastProcessedUserId) {
        predicates.push(or(
          gt(users.createdAt, progress.lastProcessedCreatedAt),
          and(eq(users.createdAt, progress.lastProcessedCreatedAt), gt(users.id, progress.lastProcessedUserId)),
        )!);
      }
      if (progress.upperBoundCreatedAt && progress.upperBoundUserId) {
        predicates.push(or(
          sql`${users.createdAt} < ${progress.upperBoundCreatedAt}`,
          and(eq(users.createdAt, progress.upperBoundCreatedAt), sql`${users.id} <= ${progress.upperBoundUserId}`),
        )!);
      }
      const rows = await tx.select().from(users)
        .where(and(...predicates)).orderBy(asc(users.createdAt), asc(users.id)).limit(input.limit);
      for (const row of rows) {
        const values: Record<string, string | null> = {};
        for (const [key, field] of Object.entries(PII_FIELDS)) {
          const value = row[key as keyof typeof row] as string | null;
          if (value === null || this.piiCipher.isValidEnvelope(field, value)) continue;
          if (this.piiCipher.looksLikeEnvelope(value)) throw new Error(`invalid_pii_envelope:${field}`);
          values[key] = this.piiCipher.encrypt(field, value);
        }
        if (Object.keys(values).length) {
          await tx.update(users).set({ ...values, updatedAt: sql`now()` }).where(eq(users.id, row.id));
        }
      }
      const last = rows.at(-1);
      const completed = rows.length < input.limit;
      await tx.update(userPiiBackfillProgress).set({
        lastProcessedCreatedAt: last?.createdAt ?? progress.lastProcessedCreatedAt,
        lastProcessedUserId: last?.id ?? progress.lastProcessedUserId,
        completedAt: completed ? new Date() : null,
        updatedAt: sql`now()`,
      }).where(eq(userPiiBackfillProgress.id, progress.id));
      return { processed: rows.length, cursor: last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null };
    });
  }
}