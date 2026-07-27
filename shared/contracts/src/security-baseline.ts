export const AUTH_COOKIE_POLICY = {
  access: {
    name: "soc_at",
    path: "/api",
    mode: "persisted",
    maxAgeSeconds: 15 * 60,
  },
  refresh: {
    name: "soc_rt",
    path: "/api/auth",
    mode: "persisted",
    maxAgeSeconds: 7 * 24 * 60 * 60,
  },
  flow: {
    name: "soc_flow",
    path: "/api/auth",
    mode: "consent_pending",
    maxAgeSeconds: 10 * 60,
  },
  temporary: {
    name: "soc_tmp",
    path: "/api/auth",
    mode: "temporary",
    maxAgeSeconds: 10 * 60,
  },
  attributes: {
    hostOnly: true,
    httpOnly: true,
    sameSite: "lax",
    secure: {
      production: true,
      development: false,
    },
    domain: "absent",
  },
} as const;

export type AuthCookieName = (typeof AUTH_COOKIE_POLICY)[keyof typeof AUTH_COOKIE_POLICY & "access" | "refresh" | "flow" | "temporary"]["name"];
export type AuthMode = "persisted" | "consent_pending" | "temporary";

export const JOSE_ES256_POLICY = {
  algorithm: "ES256",
  protectedHeader: {
    exactAllowlist: ["alg", "kid"],
    required: ["alg", "kid"],
    unknown: "rejected",
    critical: "rejected",
    remoteKeyReferences: "rejected",
  },
  algorithmAndKid: "exact_es256_and_nonempty_kid_only",
  payloadKid: "forbidden",
  issuerAndAudience: "required_exact_match",
  clockSkewSeconds: 30,
  access: {
    requiredClaims: ["iss", "aud", "sub", "sid", "mode", "iat", "exp"],
    prohibitedClaims: ["jti", "kid"],
    lifetimeSeconds: 15 * 60,
  },
  refresh: {
    requiredClaims: ["iss", "aud", "sub", "sid", "mode", "iat", "exp", "jti"],
    prohibitedClaims: ["kid"],
    lifetimeSeconds: 7 * 24 * 60 * 60,
    jti: "rotating",
  },
  verificationOrder: [
    "compact_parse",
    "exact_es256_and_header_kid_lookup",
    "signature",
    "issuer_and_audience",
    "time",
    "claim_shape",
    "redis_session_family_subject_mode",
  ],
  environmentVariables: [
    "AUTH_JWT_PUBLIC_KEYS_JSON",
    "AUTH_JWT_ACTIVE_KID",
    "AUTH_JWT_ES256_PRIVATE_KEY",
  ],
  previousPublicKeyRetentionSeconds: 7 * 24 * 60 * 60,
} as const;

export const ORIGIN_POLICY = {
  callback: {
    method: "POST",
    path: "/api/auth/login",
    exception: "exact_login_request_only",
    validation: "valid_state_and_nonce_only",
  },
  unsafeApiRequests: {
    pathPattern: "/api/**",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    excludedRequest: {
      method: "POST",
      path: "/api/auth/login",
    },
    origin: "required_exact_configured_public_origin",
    missingOrMismatch: {
      status: 403,
      code: "origin_required_or_mismatch",
    },
  },
  credentialCors: {
    production: "forbidden",
    development: "exact_configured_allowlist_only",
  },
} as const;

export interface CanonicalErrorEnvelope {
  code: string;
  message: string;
  requestId: string;
}

export const ERROR_ENVELOPE_POLICY = {
  fields: ["code", "message", "requestId"],
  requestId: {
    header: "x-request-id",
    correlationId: "same_value",
    requiredInErrors: true,
  },
  featureDisabled: {
    status: 503,
    code: "feature_disabled",
    sideEffects: "forbidden",
  },
} as const;

export const ACTOR_PII_PROJECTION_POLICY = {
  actor: {
    authenticatedOnly: "derive_from_verified_session",
    authorization: "runtime_permissions_and_scopes_only",
    noDisclosure: "unauthorized_actor_must_not_receive_existence_field_or_count_hints",
  },
  pii: {
    browserStorage: "forbidden",
    url: "forbidden",
    logsErrorsMetricsAudit: "plaintext_ciphertext_and_hash_forbidden",
    storage: "envelope_encryption_with_key_version",
    projection: "minimum_role_based_mask_or_explicit_unmask_only",
  },
  contacts: {
    requiredPermission: "CONTACTS_MANAGE",
    requiredScope: "administrator",
    canonicalFields: ["name", "email", "phone", "affiliation", "note", "kaist_uid", "year", "role"],
    unauthorizedProjection: "no_existence_field_or_count_disclosure",
    encryption: "envelope_encryption_with_key_version",
    projection: "minimum_admin_projection_with_role_based_mask_or_explicit_unmask",
  },
  audit: {
    allowedFields: ["actorId", "action", "recordId", "changedFieldNames", "timestamp", "correlationId", "reasonCode"],
    prohibitedFields: ["beforeValue", "afterValue", "plaintext", "ciphertext", "hash"],
  },
} as const;

export const COMPATIBILITY_BACKFILL_POLICY = {
  stages: {
    M0: "additive_schema_and_dual_read_compatibility",
    M1: "ordered_resumable_backfill_with_persistent_non_pii_progress",
    M2: "contract_cutover_after_backfill_readiness",
    M3: "rollback_compatibility_and_legacy_removal_eligibility",
  },
  backfill: {
    ordering: "primary_key_ascending",
    batchSize: 500,
    metrics: "non_pii_only",
    legacyPermission: "one_time_read_only_input_no_effective_privilege",
  },
  redisPreviousDecoderRetentionDays: 14,
  migration: {
    direction: "additive_forward_only",
    readiness: "migrate_only",
    validation: "journal_and_checksum_startup_and_deploy_fail_closed",
  },
} as const;
