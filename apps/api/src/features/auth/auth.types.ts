import { IsBoolean, IsIn, IsString } from "class-validator";

export type StorageMode = "temporary" | "persisted";

export const DEVELOPMENT_ACCOUNT_IDS = ["admin", "user-1", "user-2"] as const;
export type DevelopmentAccountId = (typeof DEVELOPMENT_ACCOUNT_IDS)[number];

export interface AuthoritativeSsoProfile {
  kaistUid: string;
  nameEn: string;
  nameKr: string;
  ssoSubject: string;
  studentOrEmployeeKind: "STUDENT" | "EMPLOYEE";
  studentOrEmployeeNumber: string;
  userEmail: string;
}

export class DevelopmentLoginRequestDto {
  @IsIn(DEVELOPMENT_ACCOUNT_IDS)
  account!: DevelopmentAccountId;
}

export interface PendingSsoUser extends AuthoritativeSsoProfile {
  expiresAt: number;
}

export interface TokenClaims {
  iss: string;
  aud: string;
  sub: string;
  sid: string;
  mode: StorageMode;
  iat: number;
  exp: number;
}

export interface PersistedAccessTokenClaims extends TokenClaims {
  mode: "persisted";
}

export interface TemporaryAccessTokenClaims extends TokenClaims {
  mode: "temporary";
}

export interface RefreshTokenClaims extends TokenClaims {
  jti: string;
}

export interface AuthSessionRecord {
  expiresAt: number;
  familyId: string;
  familyVersion: number;
  mode: StorageMode;
  pendingLoginId?: string;
  previousRefreshJti?: string;
  rotatedAtMs?: number;
  refreshJti: string;
  revoked: boolean;
  sessionId: string;
  userId?: string;
}

export interface ConsentDecisionRequest {
  consent: boolean;
  pendingLoginToken: string;
}

export class ConsentDecisionRequestDto {
  @IsBoolean()
  consent!: boolean;
}

export interface RefreshSessionRequest {
  refreshToken?: string;
}

export interface LogoutRequest {
  accessToken?: string;
  refreshToken?: string;
  temporaryToken?: string;
}

export class SsoCallbackBodyDto {
  @IsString()
  code?: string;

  @IsString()
  error?: string;

  @IsString()
  errorCode?: string;

  @IsString()
  state?: string;
}

export interface AuthSessionSummary {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  requiresConsent: boolean;
  storageMode: StorageMode | null;
  userId?: string;
}

export interface IssuedSessionResult {
  accessToken: string;
  refreshToken: string;
  session: AuthSessionRecord;
}

export interface CallbackPersistedResult {
  kind: "persisted";
  session: IssuedSessionResult;
  userId: string;
}

export interface CallbackConsentRequiredResult {
  kind: "consent_required";
  flowToken: string;
}

export type LoginCallbackResult =
  | CallbackPersistedResult
  | CallbackConsentRequiredResult;

export interface ConsentPersistedResult {
  kind: "persisted";
  session: IssuedSessionResult;
  userId: string;
}

export interface ConsentTemporaryResult {
  kind: "temporary";
  session: AuthSessionRecord;
  temporaryHandle: string;
}

export type ConsentDecisionResult =
  | ConsentPersistedResult
  | ConsentTemporaryResult;

export interface RefreshSessionResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  storageMode: StorageMode;
}
