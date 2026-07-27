export const PermissionScopeValues = ["GLOBAL", "BOARD", "EVENT", "SURVEY"] as const;
export type PermissionScope = (typeof PermissionScopeValues)[number];

export const PermissionChangeActions = ["GRANT", "REVOKE"] as const;
export type PermissionChangeAction = (typeof PermissionChangeActions)[number];

export const PermissionChangeStatuses = [
  "PENDING",
  "APPROVED",
  "ACTIVATED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type PermissionChangeStatus = (typeof PermissionChangeStatuses)[number];

export interface PermissionRequestInput {
  targetUserId: string;
  action: PermissionChangeAction;
  permission: string;
  scope: PermissionScope;
  scopeId?: string;
  reasonCode: string;
}
