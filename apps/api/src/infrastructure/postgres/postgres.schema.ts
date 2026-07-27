import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const feeStatusEnum = pgEnum("fee_status", ["UNKNOWN", "UNPAID", "PAID"]);
export const permissionGrantScopeEnum = pgEnum("permission_grant_scope", [
  "GLOBAL",
  "BOARD",
  "EVENT",
  "SURVEY",
]);
export const permissionChangeActionEnum = pgEnum("permission_change_action", [
  "GRANT",
  "REVOKE",
]);
export const permissionChangeRequestStatusEnum = pgEnum("permission_change_request_status", [
  "PENDING",
  "APPROVED",
  "ACTIVATED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Legacy SSO identifier: compatibility input only. It is never runtime authority.
    ssoUserId: text("sso_user_id").notNull().unique(),
    // Immutable canonical SSO subject once populated by the ordered backfill.
    ssoSubject: text("sso_subject"),
    kaistUid: text("kaist_uid"),
    studentOrEmployeeNumber: text("student_or_employee_number"),
    nameKr: text("name_kr"),
    nameEn: text("name_en"),
    majorMask: integer("major_mask").notNull().default(0),
    feeStatus: feeStatusEnum("fee_status").notNull().default("UNKNOWN"),
    // Legacy permission bitmask: read-only backfill input, never effective authority.
    permission: integer("permission").notNull().default(0),
    userEmail: text("user_email"),
    userMobile: text("user_mobile"),
    privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_sso_subject_unique").on(table.ssoSubject),
    uniqueIndex("users_kaist_uid_unique").on(table.kaistUid),
  ],
);

export const permissionDefinitions = pgTable(
  "permission_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    description: text("description").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("permission_definitions_key_unique").on(table.key)],
);

export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    permissionDefinitionId: uuid("permission_definition_id")
      .notNull()
      .references(() => permissionDefinitions.id),
    scope: permissionGrantScopeEnum("scope").notNull(),
    scopeId: text("scope_id"),
    grantedByUserId: uuid("granted_by_user_id").notNull().references(() => users.id),
    activatedFrom: timestamp("activated_from", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "permission_grants_scope_id_check",
      sql`(${table.scope} = 'GLOBAL' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'GLOBAL' AND ${table.scopeId} IS NOT NULL)`,
    ),
    index("permission_grants_effective_lookup_idx").on(
      table.userId,
      table.permissionDefinitionId,
      table.scope,
      table.scopeId,
    ),
    uniqueIndex("permission_grants_effective_unique")
      .on(
        table.userId,
        table.permissionDefinitionId,
        table.scope,
        sql`COALESCE(${table.scopeId}, '')`,
      )
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export const permissionChangeRequests = pgTable(
  "permission_change_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetUserId: uuid("target_user_id").notNull().references(() => users.id),
    action: permissionChangeActionEnum("action").notNull(),
    requestedReasonCode: text("requested_reason_code").notNull(),
    permissionDefinitionId: uuid("permission_definition_id")
      .notNull()
      .references(() => permissionDefinitions.id),
    scope: permissionGrantScopeEnum("scope").notNull(),
    scopeId: text("scope_id"),
    requestHash: text("request_hash").notNull(),
    status: permissionChangeRequestStatusEnum("status").notNull().default("PENDING"),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id),
    approverUserId: uuid("approver_user_id").references(() => users.id),
    approvalReasonCode: text("approval_reason_code"),
    activatorUserId: uuid("activator_user_id").references(() => users.id),
    activationReasonCode: text("activation_reason_code"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
  },
  (table) => [
    check(
      "permission_change_requests_scope_id_check",
      sql`(${table.scope} = 'GLOBAL' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'GLOBAL' AND ${table.scopeId} IS NOT NULL)`,
    ),
    check(
      "permission_change_requests_actor_separation_check",
      sql`(${table.approverUserId} IS NULL OR (${table.approverUserId} <> ${table.requesterUserId} AND ${table.approverUserId} <> ${table.targetUserId})) AND (${table.activatorUserId} IS NULL OR ${table.activatorUserId} <> ${table.requesterUserId})`,
    ),
    check(
      "permission_change_requests_requested_reason_code_technical_identifier_check",
      sql`${table.requestedReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_change_requests_approval_reason_code_technical_identifier_check",
      sql`${table.approvalReasonCode} IS NULL OR ${table.approvalReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_change_requests_activation_reason_code_technical_identifier_check",
      sql`${table.activationReasonCode} IS NULL OR ${table.activationReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    index("permission_change_requests_request_hash_idx").on(table.requestHash),
    index("permission_change_requests_pending_idx").on(table.status, table.expiresAt),
  ],
);

export const permissionAuditLog = pgTable(
  "permission_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    recordId: uuid("record_id").notNull(),
    changedFieldNames: text("changed_field_names").notNull(),
    correlationId: text("correlation_id").notNull(),
    reasonCode: text("reason_code"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "permission_audit_log_action_technical_identifier_check",
      sql`${table.action} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_audit_log_reason_code_technical_identifier_check",
      sql`${table.reasonCode} IS NULL OR ${table.reasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    index("permission_audit_log_occurred_at_idx").on(table.occurredAt),
    index("permission_audit_log_occurred_at_id_idx").on(table.occurredAt, table.id),
  ],
);

export const authorizationBootstrapState = pgTable("authorization_bootstrap_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authorizationBackfillProgress = pgTable("authorization_backfill_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobKey: text("job_key").notNull().unique(),
  lastProcessedUserId: uuid("last_processed_user_id").references(() => users.id),
  upperBoundUserId: uuid("upper_bound_user_id").references(() => users.id),
  batchSize: integer("batch_size").notNull().default(500),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentCouncilRoleSnapshots = pgTable(
  "student_council_role_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kaistUidSnapshot: text("kaist_uid_snapshot").notNull(),
    year: integer("year").notNull(),
    roleKey: text("role_key").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("student_council_role_snapshots_user_idx").on(table.userId, table.capturedAt),
    index("student_council_role_snapshots_uid_year_idx").on(
      table.kaistUidSnapshot,
      table.year,
    ),
  ],
);
