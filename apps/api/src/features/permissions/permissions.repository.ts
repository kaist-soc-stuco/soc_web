import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  authorizationBackfillProgress,
  authorizationBootstrapState,
  permissionAuditLog,
  permissionChangeRequests,
  permissionDefinitions,
  permissionGrants,
  users,
} from "../../infrastructure/postgres/postgres.schema";
import { DRIZZLE_DB } from "../../infrastructure/postgres/postgres.provider";
import type { PermissionChangeAction, PermissionScope } from "./permission.types";

@Injectable()
export class PermissionsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async findEffectivePermission(userId: string, key: string, scope: PermissionScope, scopeId: string | null) {
    return this.db
      .select({ id: permissionGrants.id })
      .from(permissionGrants)
      .innerJoin(permissionDefinitions, eq(permissionDefinitions.id, permissionGrants.permissionDefinitionId))
      .where(and(
        eq(permissionGrants.userId, userId),
        eq(permissionDefinitions.key, key),
        eq(permissionDefinitions.isActive, true),
        lte(permissionGrants.activatedFrom, sql`now()`),
        isNull(permissionGrants.revokedAt),
        or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, sql`now()`)),
        or(
          eq(permissionGrants.scope, "GLOBAL"),
          and(eq(permissionGrants.scope, scope), scopeId === null ? isNull(permissionGrants.scopeId) : eq(permissionGrants.scopeId, scopeId)),
        ),
      ))
      .limit(1);
  }

  async createRequest(input: {
    targetUserId: string; action: PermissionChangeAction; reasonCode: string; permissionDefinitionId: string;
    scope: PermissionScope; scopeId: string | null; requestHash: string; requesterUserId: string; authorityKey: string;
    usersManageAuthorityKey: string;
  }) {
    return this.db.transaction(async (tx) => {
      if (
        !(await this.hasEffectiveGlobalAuthority(tx, input.requesterUserId, input.usersManageAuthorityKey))
        || !(await this.hasEffectiveAuthority(tx, input.requesterUserId, input.authorityKey, input.scope, input.scopeId))
      ) return null;
      const [record] = await tx.insert(permissionChangeRequests).values({
        targetUserId: input.targetUserId, action: input.action, requestedReasonCode: input.reasonCode,
        permissionDefinitionId: input.permissionDefinitionId, scope: input.scope, scopeId: input.scopeId,
        requestHash: input.requestHash, requesterUserId: input.requesterUserId,
      }).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.requesterUserId,
        action: "PERMISSION_REQUEST_CREATED",
        recordId: record.id,
        changedFieldNames: "action,targetUserId,permissionDefinitionId,scope,status",
        correlationId: record.id,
        reasonCode: input.reasonCode,
      });
      return record;
    });
  }

  async findDefinition(key: string) {
    const [definition] = await this.db.select().from(permissionDefinitions)
      .where(and(eq(permissionDefinitions.key, key), eq(permissionDefinitions.isActive, true))).limit(1);
    return definition ?? null;
  }
  async findCanonicalSubject(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ ssoSubject: users.ssoSubject })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.ssoSubject ?? null;
  }

  async userExists(userId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return Boolean(user);
  }

  async listAudit(limit: number, before?: { occurredAt: Date; id: string }) {
    return this.db.select({
      id: permissionAuditLog.id,
      actorUserId: permissionAuditLog.actorUserId,
      action: permissionAuditLog.action,
      recordId: permissionAuditLog.recordId,
      changedFieldNames: permissionAuditLog.changedFieldNames,
      correlationId: permissionAuditLog.correlationId,
      reasonCode: permissionAuditLog.reasonCode,
      occurredAt: permissionAuditLog.occurredAt,
    }).from(permissionAuditLog)
      .where(and(
        before
          ? sql`(${permissionAuditLog.occurredAt}, ${permissionAuditLog.id}) < (${before.occurredAt}, ${before.id}::uuid)`
          : undefined,
      ))
      .orderBy(sql`${permissionAuditLog.occurredAt} DESC`, sql`${permissionAuditLog.id} DESC`).limit(limit);
  }

  async hasAnyWorkflowAuthority(actorUserId: string): Promise<boolean> {
    const authority = await this.db.execute(sql`
      SELECT 1
      FROM permission_grants grant_record
      INNER JOIN permission_definitions definition ON definition.id = grant_record.permission_definition_id
      WHERE grant_record.user_id = ${actorUserId}
        AND definition.key IN ('PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE')
        AND definition.is_active = true
        AND grant_record.activated_from <= now()
        AND grant_record.revoked_at IS NULL
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > now())
      LIMIT 1
    `);
    return authority.rows.length === 1;
  }

  async listActiveDefinitions() {
    return this.db.select({
      key: permissionDefinitions.key,
      description: permissionDefinitions.description,
    }).from(permissionDefinitions)
      .where(eq(permissionDefinitions.isActive, true))
      .orderBy(asc(permissionDefinitions.key));
  }

  async listRequests(
    actorUserId: string,
    stage: "REQUESTED" | "APPROVAL" | "ACTIVATION",
    limit: number,
    before?: { requestedAt: Date; id: string },
  ) {
    const authorityKey = stage === "APPROVAL" ? "PERMISSION_APPROVE" : "PERMISSION_ACTIVATE";
    const stageCondition = stage === "REQUESTED"
      ? and(
        eq(permissionChangeRequests.status, "PENDING"),
        eq(permissionChangeRequests.requesterUserId, actorUserId),
      )
      : and(
        eq(permissionChangeRequests.status, stage === "APPROVAL" ? "PENDING" : "APPROVED"),
        sql`${permissionChangeRequests.requesterUserId} <> ${actorUserId}::uuid`,
        stage === "APPROVAL" ? sql`${permissionChangeRequests.targetUserId} <> ${actorUserId}::uuid` : undefined,
        sql`EXISTS (
          SELECT 1
          FROM permission_grants grant_record
          INNER JOIN permission_definitions authority_definition ON authority_definition.id = grant_record.permission_definition_id
          WHERE grant_record.user_id = ${actorUserId}
            AND authority_definition.key = ${authorityKey}
            AND authority_definition.is_active = true
            AND grant_record.activated_from <= now()
            AND grant_record.revoked_at IS NULL
            AND (grant_record.expires_at IS NULL OR grant_record.expires_at > now())
            AND (
              grant_record.scope = 'GLOBAL'
              OR (
                grant_record.scope = ${permissionChangeRequests.scope}
                AND grant_record.scope_id IS NOT DISTINCT FROM ${permissionChangeRequests.scopeId}
              )
            )
        )`,
      );

    return this.db.select({
      id: permissionChangeRequests.id,
      targetUserId: permissionChangeRequests.targetUserId,
      action: permissionChangeRequests.action,
      permission: permissionDefinitions.key,
      scope: permissionChangeRequests.scope,
      scopeId: permissionChangeRequests.scopeId,
      status: permissionChangeRequests.status,
      requestedAt: permissionChangeRequests.requestedAt,
      approvedAt: permissionChangeRequests.approvedAt,
      activatedAt: permissionChangeRequests.activatedAt,
      expiresAt: permissionChangeRequests.expiresAt,
    }).from(permissionChangeRequests)
      .innerJoin(permissionDefinitions, eq(permissionDefinitions.id, permissionChangeRequests.permissionDefinitionId))
      .where(and(
        stageCondition,
        gt(permissionChangeRequests.expiresAt, sql`now()`),
        before
          ? sql`(${permissionChangeRequests.requestedAt}, ${permissionChangeRequests.id}) < (${before.requestedAt}, ${before.id}::uuid)`
          : undefined,
      ))
      .orderBy(desc(permissionChangeRequests.requestedAt), desc(permissionChangeRequests.id))
      .limit(limit);
  }

  async approveRequest(id: string, actorUserId: string, reasonCode: string, authorityKey: string) {
    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .select({ request: permissionChangeRequests, permission: permissionDefinitions.key })
        .from(permissionChangeRequests)
        .innerJoin(permissionDefinitions, eq(permissionDefinitions.id, permissionChangeRequests.permissionDefinitionId))
        .where(eq(permissionChangeRequests.id, id))
        .for("update");
      if (
        !request
        || !(await this.hasEffectiveAuthority(
          tx,
          actorUserId,
          authorityKey,
          request.request.scope,
          request.request.scopeId,
        ))
        || request.request.requesterUserId === actorUserId
        || request.request.targetUserId === actorUserId
      ) return null;
      if (request.request.status === "PENDING" && (await tx.execute(sql`SELECT now() >= ${request.request.expiresAt} AS expired`)).rows[0]?.expired) {
        await tx.update(permissionChangeRequests).set({ status: "EXPIRED" }).where(eq(permissionChangeRequests.id, id));
        return null;
      }
      if (request.request.status !== "PENDING" || request.request.requestHash !== this.requestHash(request.request)) return null;
      const [updated] = await tx.update(permissionChangeRequests).set({ status: "APPROVED", approverUserId: actorUserId, approvalReasonCode: reasonCode, approvedAt: sql`now()` }).where(eq(permissionChangeRequests.id, id)).returning();
      await tx.insert(permissionAuditLog).values({ actorUserId, action: "PERMISSION_REQUEST_APPROVED", recordId: id, changedFieldNames: "status,approverUserId,approvedAt", correlationId: id, reasonCode });
      return { ...updated, permission: request.permission };
    });
  }

  async activateRequest(id: string, actorUserId: string, reasonCode: string, authorityKey: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('authorization_bootstrap_v1'))`);
      const [request] = await tx
        .select({ request: permissionChangeRequests, permission: permissionDefinitions.key })
        .from(permissionChangeRequests)
        .innerJoin(permissionDefinitions, eq(permissionDefinitions.id, permissionChangeRequests.permissionDefinitionId))
        .where(eq(permissionChangeRequests.id, id))
        .for("update");
      if (
        !request
        || !(await this.hasEffectiveAuthority(
          tx,
          actorUserId,
          authorityKey,
          request.request.scope,
          request.request.scopeId,
        ))
        || request.request.requesterUserId === actorUserId
      ) return null;
      if (request.request.status === "APPROVED" && (await tx.execute(sql`SELECT now() >= ${request.request.expiresAt} AS expired`)).rows[0]?.expired) {
        await tx.update(permissionChangeRequests).set({ status: "EXPIRED" }).where(eq(permissionChangeRequests.id, id));
        return null;
      }
      if (request.request.status !== "APPROVED" || request.request.requestHash !== this.requestHash(request.request)) return null;

      const mutation = request.request.action === "GRANT"
        ? await tx.execute(sql`
            WITH reactivated AS (
              UPDATE permission_grants
              SET revoked_at = NULL, revoked_by_user_id = NULL, activated_from = now(), expires_at = NULL, granted_by_user_id = ${actorUserId}
              WHERE user_id = ${request.request.targetUserId}
                AND permission_definition_id = ${request.request.permissionDefinitionId}
                AND scope = ${request.request.scope}
                AND scope_id IS NOT DISTINCT FROM ${request.request.scopeId}
                AND revoked_at IS NULL
                AND expires_at <= now()
              RETURNING id
            ), inserted AS (
              INSERT INTO permission_grants (user_id, permission_definition_id, scope, scope_id, granted_by_user_id)
              SELECT ${request.request.targetUserId}, ${request.request.permissionDefinitionId}, ${request.request.scope}, ${request.request.scopeId}, ${actorUserId}
              WHERE NOT EXISTS (SELECT 1 FROM reactivated)
              ON CONFLICT DO NOTHING
              RETURNING id
            )
            SELECT id FROM reactivated UNION ALL SELECT id FROM inserted
          `)
        : await tx.execute(sql`
            UPDATE permission_grants
            SET revoked_at = now(), revoked_by_user_id = ${actorUserId}
            WHERE user_id = ${request.request.targetUserId}
              AND permission_definition_id = ${request.request.permissionDefinitionId}
              AND scope = ${request.request.scope}
              AND scope_id IS NOT DISTINCT FROM ${request.request.scopeId}
              AND revoked_at IS NULL
            RETURNING id
          `);
      if (mutation.rows.length !== 1) return null;

      const [updated] = await tx.update(permissionChangeRequests).set({ status: "ACTIVATED", activatorUserId: actorUserId, activationReasonCode: reasonCode, activatedAt: sql`now()` }).where(eq(permissionChangeRequests.id, id)).returning();
      await tx.insert(permissionAuditLog).values({ actorUserId, action: `PERMISSION_${request.request.action}_ACTIVATED`, recordId: id, changedFieldNames: "status,activatorUserId,activatedAt", correlationId: id, reasonCode });
      return { ...updated, permission: request.permission };
    });
  }

  async bootstrap(actorUserId: string, subject: string, fingerprint: string, keys: string[]) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('authorization_bootstrap_v1'))`);
      const [completed] = await tx.select({ id: authorizationBootstrapState.id }).from(authorizationBootstrapState)
        .where(sql`${authorizationBootstrapState.completedAt} IS NOT NULL`).limit(1);
      if (completed) return false;
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(permissionGrants).where(isNull(permissionGrants.revokedAt));
      if (Number(count) !== 0) return false;
      const [user] = await tx.select({ id: users.id }).from(users).where(and(eq(users.ssoSubject, subject), eq(users.id, actorUserId))).limit(1);
      if (!user) return false;
      const definitions = await tx.select().from(permissionDefinitions).where(and(inArray(permissionDefinitions.key, keys), eq(permissionDefinitions.isActive, true)));
      if (definitions.length !== keys.length) return false;
      for (const definition of definitions) await tx.insert(permissionGrants).values({ userId: user.id, permissionDefinitionId: definition.id, scope: "GLOBAL", grantedByUserId: user.id });
      await tx.insert(authorizationBootstrapState).values({ fingerprint, completedAt: sql`now()` });
      await tx.insert(permissionAuditLog).values({ actorUserId: user.id, action: "AUTHORIZATION_BOOTSTRAPPED", recordId: user.id, changedFieldNames: "authorizationBootstrapState,permissionGrants", correlationId: fingerprint, reasonCode: "BOOTSTRAP" });
      return true;
    });
  }

  async backfillLegacyPermissions() {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('authorization_backfill_legacy_permission_v1'))`);
      const [progress] = await tx.select({
        id: authorizationBackfillProgress.id,
        jobKey: authorizationBackfillProgress.jobKey,
        lastProcessedUserId: authorizationBackfillProgress.lastProcessedUserId,
        upperBoundUserId: authorizationBackfillProgress.upperBoundUserId,
        lastProcessedCreatedAt: sql<string | null>`${authorizationBackfillProgress.lastProcessedCreatedAt}::text`,
        upperBoundCreatedAt: sql<string | null>`${authorizationBackfillProgress.upperBoundCreatedAt}::text`,
      }).from(authorizationBackfillProgress).where(eq(authorizationBackfillProgress.jobKey, "legacy_permission_v1")).for("update");
      const [boundary] = !progress?.upperBoundCreatedAt || !progress.upperBoundUserId
        ? await tx.select({ createdAt: sql<string>`${users.createdAt}::text`, id: users.id }).from(users).orderBy(desc(users.createdAt), desc(users.id)).limit(1)
        : [];
      const upperCreatedAt = progress?.upperBoundCreatedAt ?? boundary?.createdAt ?? null;
      const upperId = progress?.upperBoundUserId ?? boundary?.id ?? null;
      const afterCreatedAt = progress?.lastProcessedCreatedAt;
      const afterId = progress?.lastProcessedUserId;
      const batch = await tx.select({ id: users.id, createdAt: sql<string>`${users.createdAt}::text`, permission: users.permission })
        .from(users)
        .where(and(
          afterCreatedAt && afterId ? sql`(${users.createdAt}, ${users.id}) > (${afterCreatedAt}::timestamptz, ${afterId}::uuid)` : undefined,
          upperCreatedAt && upperId ? sql`(${users.createdAt}, ${users.id}) <= (${upperCreatedAt}::timestamptz, ${upperId}::uuid)` : sql`false`,
        ))
        .orderBy(asc(users.createdAt), asc(users.id)).limit(500);
      const last = batch.at(-1);
      const lastCreatedAt = last?.createdAt ?? progress?.lastProcessedCreatedAt ?? null;
      const values = { lastProcessedCreatedAt: lastCreatedAt ? sql`${lastCreatedAt}::timestamptz` : null, lastProcessedUserId: last?.id ?? progress?.lastProcessedUserId ?? null, completedAt: last ? null : sql`now()`, updatedAt: sql`now()` };
      if (progress) await tx.update(authorizationBackfillProgress).set(values).where(eq(authorizationBackfillProgress.id, progress.id));
      else await tx.insert(authorizationBackfillProgress).values({ jobKey: "legacy_permission_v1", ...values, upperBoundCreatedAt: upperCreatedAt ? sql`${upperCreatedAt}::timestamptz` : null, upperBoundUserId: upperId, batchSize: 500 });
      for (const row of batch) if (row.permission !== 0) await tx.insert(permissionAuditLog).values({ actorUserId: null, action: "LEGACY_PERMISSION_DENIED_REVIEW", recordId: row.id, changedFieldNames: "permission", correlationId: "legacy_permission_v1", reasonCode: "AMBIGUOUS_LEGACY_VALUE" });
      return { processed: batch.length, completed: batch.length === 0 };
    });
  }

  private async hasEffectiveGlobalAuthority(tx: NodePgDatabase, actorUserId: string, authorityKey: string) {
    const authority = await tx.execute(sql`
      SELECT 1
      FROM permission_grants grant_record
      INNER JOIN permission_definitions definition ON definition.id = grant_record.permission_definition_id
      WHERE grant_record.user_id = ${actorUserId}
        AND definition.key = ${authorityKey}
        AND definition.is_active = true
        AND grant_record.activated_from <= now()
        AND grant_record.revoked_at IS NULL
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > now())
        AND grant_record.scope = 'GLOBAL'
      LIMIT 1
      FOR UPDATE OF grant_record
    `);
    return authority.rows.length === 1;
  }
  private async hasEffectiveAuthority(tx: NodePgDatabase, actorUserId: string, authorityKey: string, scope: PermissionScope, scopeId: string | null) {
    const authority = await tx.execute(sql`
      SELECT 1
      FROM permission_grants grant_record
      INNER JOIN permission_definitions definition ON definition.id = grant_record.permission_definition_id
      WHERE grant_record.user_id = ${actorUserId}
        AND definition.key = ${authorityKey}
        AND definition.is_active = true
        AND grant_record.activated_from <= now()
        AND grant_record.revoked_at IS NULL
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > now())
        AND (grant_record.scope = 'GLOBAL' OR (
          grant_record.scope = ${scope}
          AND grant_record.scope_id IS NOT DISTINCT FROM ${scopeId}
        ))
      LIMIT 1
      FOR UPDATE OF grant_record
    `);
    return authority.rows.length === 1;
  }
  private requestHash(request: {
    action: PermissionChangeAction; permissionDefinitionId: string; requestedReasonCode: string;
    requesterUserId: string; scope: PermissionScope; scopeId: string | null; targetUserId: string;
  }): string {
    const value = {
      action: request.action, permissionDefinitionId: request.permissionDefinitionId,
      reasonCode: request.requestedReasonCode, requesterUserId: request.requesterUserId,
      scope: request.scope, scopeId: request.scopeId, targetUserId: request.targetUserId,
    };
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
    return createHash("sha256").update(canonical).digest("hex");
  }
}
