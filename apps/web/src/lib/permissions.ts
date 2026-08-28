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
import type { BoardMetadata } from "./board-metadata";
import { getBoardWriteAccessTypeFromMetadata } from "./board-metadata";

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
  Permissions.hasAny(
    permission ?? 0,
    Permissions.MANAGE_SURVEY,
    Permissions.MANAGE_POLL,
  );

const ADMIN_ENTRY_PERMISSIONS = [
  Permissions.MANAGE_SURVEY,
  Permissions.MANAGE_POLL,
  Permissions.MANAGE_SITE_CONTENT,
  Permissions.MANAGE_CALENDAR,
  Permissions.MANAGE_USERS,
  Permissions.MANAGE_PERMISSIONS,
  Permissions.MANAGE_FINANCE,
  Permissions.MANAGE_CONTACTS,
  Permissions.SEND_EMAIL,
  Permissions.VIEW_AUDIT_LOG,
  Permissions.MANAGE_BOARD_SETTINGS,
] as const;

export const hasAdminPermission = (permission?: number | null): boolean =>
  Permissions.hasAny(permission ?? 0, ...ADMIN_ENTRY_PERMISSIONS);

export const hasFinancePermission = (permission?: number | null): boolean =>
  Permissions.has(permission ?? 0, Permissions.MANAGE_FINANCE);

export const getGrantedPermissions = (permission?: number | null) =>
  Permissions.granted(permission ?? 0);

export const canWriteToBoard = (
  board: Pick<BoardMetadata, "code" | "writeAccessType" | "writePermissionBit"> &
    Partial<Pick<BoardMetadata, "writeRoleGroupIds" | "canWrite">>,
  permission?: number | null,
): boolean => {
  if (board.canWrite !== undefined) return board.canWrite;

  const userPermission = permission ?? 0;
  const accessType = getBoardWriteAccessTypeFromMetadata(board, board.code);

  if (accessType === "AUTHENTICATED") {
    return Permissions.has(userPermission, Permissions.POST_CREATE);
  }
  if (accessType === "ROLE_GROUP") return false;
  if (accessType === "EXECUTIVE") {
    return Permissions.has(userPermission, Permissions.POST_OFFICIAL);
  }

  return (
    board.writePermissionBit > 0 &&
    Permissions.has(userPermission, board.writePermissionBit)
  );
};

export const canUseOfficialIdentityForBoard = (
  board: Pick<BoardMetadata, "code" | "writeAccessType" | "writePermissionBit"> &
    Partial<Pick<BoardMetadata, "canUseOfficialIdentity">>,
  permission?: number | null,
): boolean => {
  if (board.canUseOfficialIdentity !== undefined) {
    return board.canUseOfficialIdentity;
  }

  const userPermission = permission ?? 0;
  const accessType = getBoardWriteAccessTypeFromMetadata(board, board.code);
  const hasBoardWriterPermission =
    accessType === "EXECUTIVE"
      ? Permissions.has(userPermission, Permissions.POST_OFFICIAL)
      : accessType === "PERMISSION"
        ? board.writePermissionBit > 0 &&
          Permissions.has(userPermission, board.writePermissionBit)
        : Permissions.hasAny(
            userPermission,
      Permissions.POST_OFFICIAL,
      Permissions.POST_CREATE,
          );

  return (
    hasBoardWriterPermission ||
    Permissions.hasAny(
      userPermission,
      Permissions.POST_OFFICIAL,
      Permissions.MANAGE_SUGGESTION_REPLY,
      Permissions.SUPER_ADMIN,
    )
  );
};

export const canWriteOfficialResponseForBoard = (
  board: Pick<BoardMetadata, "allowOfficialReply">,
  permission?: number | null,
): boolean => {
  if (!board.allowOfficialReply) return false;
  const userPermission = permission ?? 0;
  return (
    Permissions.has(userPermission, Permissions.SUPER_ADMIN) ||
    Permissions.has(
      userPermission,
      Permissions.MANAGE_SUGGESTION_REPLY,
      Permissions.POST_OFFICIAL,
    )
  );
};
