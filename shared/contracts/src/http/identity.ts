export type FeeStatus = "UNKNOWN" | "UNPAID" | "PAID";
export type StudentOrEmployeeKind = "STUDENT" | "EMPLOYEE";
export type PermissionGrantScope = "GLOBAL" | "BOARD" | "EVENT" | "SURVEY";
export type PermissionChangeAction = "GRANT" | "REVOKE";
export type PermissionChangeRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "ACTIVATED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export interface EffectivePermissionGrant {
  id: string;
  permission: string;
  scope: PermissionGrantScope;
  scopeId: string | null;
  activatedFrom: string;
  expiresAt: string | null;
}

export interface UserProfile {
  id: string;
  kaistUid: string | null;
  studentOrEmployeeNumber: string | null;
  studentOrEmployeeKind: StudentOrEmployeeKind | null;
  nameKr: string | null;
  nameEn: string | null;
  majorMask: number;
  userEmail: string | null;
  userMobile: string | null;
  privacyConsentAt: string | null;
  feeStatus: FeeStatus;
}

export interface UserMeResponse extends UserProfile {
  grants: EffectivePermissionGrant[];
}

export interface PatchMeRequest {
  userMobile?: string | null;
}

export interface AdminUserProfile {
  id: string;
  kaistUid: string | null;
  studentOrEmployeeNumber: string | null;
  studentOrEmployeeKind: StudentOrEmployeeKind | null;
  nameKr: string | null;
  nameEn: string | null;
  majorMask: number;
  privacyConsentAt: string | null;
}

export interface AdminUserListQuery {
  cursor?: string;
  limit?: number;
  name?: string;
  studentOrEmployeeNumber?: string;
  feeStatus?: FeeStatus;
}

export interface AdminUserListItem extends AdminUserProfile {
  grants: EffectivePermissionGrant[];
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  nextCursor: string | null;
}

export interface AdminUserGetResponse extends AdminUserProfile {
  grants: EffectivePermissionGrant[];
}

export interface PermissionGrantRequest {
  targetUserId: string;
  action: PermissionChangeAction;
  permission: string;
  scope: PermissionGrantScope;
  scopeId?: string;
  reasonCode: string;
}

export interface PermissionGrantRequestResponse {
  id: string;
  requestHash: string;
  status: "PENDING";
  requestedAt: string;
  expiresAt: string;
}

export interface PermissionGrantApproveRequest {
  reasonCode: string;
}

export interface PermissionGrantActivateRequest {
  reasonCode: string;
}

export interface PermissionChangeRequestResponse {
  id: string;
  targetUserId: string;
  action: PermissionChangeAction;
  permission: string;
  scope: PermissionGrantScope;
  scopeId: string | null;
  status: PermissionChangeRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  activatedAt: string | null;
  expiresAt: string;
}
export interface PermissionDefinition {
  key: string;
  description: string;
}

export interface PermissionDefinitionListResponse {
  items: PermissionDefinition[];
}

export type PermissionRequestQueueStage = "REQUESTED" | "APPROVAL" | "ACTIVATION";

export interface PermissionRequestQueueListResponse {
  items: PermissionChangeRequestResponse[];
  nextCursor: string | null;
}

export interface FeeSelfResponse {
  feeStatus: FeeStatus;
}

export type FeeUpdateReasonCode = "PAYMENT_REVIEWED" | "PAYMENT_CONFIRMED" | "PAYMENT_NOT_FOUND" | "DATA_CORRECTION";

export interface AdminFeeUpdateRequest {
  feeStatus: FeeStatus;
  reasonCode: FeeUpdateReasonCode;
  operatorNote?: string;
}


export interface AdminFeeUpdateResponse {
  userId: string;
  feeStatus: FeeStatus;
  updatedAt: string;
}

/** This projection intentionally contains no profile, contact, or value data. */
export interface PermissionAuditEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  recordId: string;
  changedFieldNames: string[];
  correlationId: string;
  reasonCode: string | null;
  occurredAt: string;
}

export interface PermissionAuditListQuery {
  cursor?: string;
  limit?: number;
}

export interface PermissionAuditListResponse {
  items: PermissionAuditEntry[];
  nextCursor: string | null;
}
export interface AdminFeeListQuery {
  cursor?: string;
  limit?: number;
  name?: string;
  studentOrEmployeeNumber?: string;
  feeStatus?: FeeStatus;
}

export interface AdminFeeListItem {
  id: string;
  studentOrEmployeeKind: StudentOrEmployeeKind | null;
  studentOrEmployeeNumber: string | null;
  nameKr: string | null;
  nameEn: string | null;
  feeStatus: FeeStatus;
  updatedAt: string;
}

export interface AdminFeeListResponse {
  items: AdminFeeListItem[];
  nextCursor: string | null;
}
