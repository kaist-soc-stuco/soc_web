/**
 * 프론트엔드용 권한 유틸리티.
 *
 * 모든 bit 값과 정의는 @soc/contracts의 SSOT에서 가져옵니다.
 * 여기서 bit 값을 직접 하드코딩하지 않습니다.
 */
import {
  Permissions,
  PERMISSION_REGISTRY,
  type PermissionDefinition,
} from "@soc/contracts";

// ─── Re-export for convenience ───────────────────────────────────────────────

export { Permissions, PERMISSION_REGISTRY };
export type { PermissionDefinition };

// ─── UI용 정의 목록 (labelKo, description 포함) ────────────────────────────

export const PERMISSION_DEFINITIONS = PERMISSION_REGISTRY.map((def) => ({
  key: def.code,
  bit: def.bit,
  label: def.labelKo,
  description: def.description,
}));

// ─── Convenience helpers ─────────────────────────────────────────────────────

export const hasSurveyManagePermission = (permission?: number | null): boolean =>
  Permissions.has(permission ?? 0, Permissions.MANAGE_SURVEY);

export const hasAdminPermission = (permission?: number | null): boolean =>
  Permissions.has(permission ?? 0, Permissions.ADMIN);

export const hasFinancePermission = (permission?: number | null): boolean =>
  Permissions.has(permission ?? 0, Permissions.MANAGE_FINANCE);

export const getGrantedPermissions = (permission?: number | null) =>
  Permissions.granted(permission ?? 0);
