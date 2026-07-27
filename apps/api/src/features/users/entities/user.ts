import type { FeeStatus } from "@soc/contracts";

export interface EffectivePermissionGrant {
  activatedFrom: string;
  expiresAt: string | null;
  id: string;
  permission: string;
  scope: "GLOBAL" | "BOARD" | "EVENT" | "SURVEY";
  scopeId: string | null;
}

export interface UserRecord {
  createdAt: string;
  feeStatus: FeeStatus;
  id: string;
  kaistUid: string | null;
  majorMask: number;
  nameEn: string | null;
  nameKr: string | null;
  privacyConsentAt: string | null;
  ssoSubject: string | null;
  ssoUserId: string;
  studentOrEmployeeNumber: string | null;
  updatedAt: string;
  userEmail: string | null;
  userMobile: string | null;
}
