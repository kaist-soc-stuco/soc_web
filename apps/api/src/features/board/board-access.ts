import type { BoardSummary } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

export interface CurrentUserContext {
  authenticated: boolean;
  user?: {
    id: string;
    permission: number;
    roleGroupIds?: number[];
  };
}

export interface BoardUser {
  id: string;
  permission: number;
  roleGroupIds?: number[];
}

type BoardWriteConfig = Pick<
  BoardSummary,
  "writeAccessType" | "writePermissionBit"
> &
  Partial<Pick<BoardSummary, "writeRoleGroupIds">>;

const hasSystemOverride = (user: BoardUser): boolean =>
  Permissions.has(user.permission, Permissions.SUPER_ADMIN);

const hasRoleMapping = (
  board: BoardWriteConfig,
): board is BoardWriteConfig & { writeRoleGroupIds: number[] } =>
  Array.isArray(board.writeRoleGroupIds) && board.writeRoleGroupIds.length > 0;

/**
 * 게시판 작성 범위는 역할 그룹 매핑으로 결정합니다.
 * 레거시 필드는 마이그레이션 중인 게시판에만 안전한 fallback으로 남겨 둡니다.
 */
export const canWriteToBoard = (
  board: BoardWriteConfig,
  user: BoardUser,
): boolean => {
  if (hasSystemOverride(user)) return true;

  if (hasRoleMapping(board)) {
    return (
      Permissions.has(user.permission, Permissions.POST_CREATE) &&
      (user.roleGroupIds ?? []).some((roleGroupId) =>
        board.writeRoleGroupIds.includes(roleGroupId),
      )
    );
  }

  // Legacy boards are only accepted when their old capability is still
  // explicit. New/seeded boards always have role mappings.
  if (board.writeAccessType === "AUTHENTICATED") {
    return Permissions.has(user.permission, Permissions.POST_CREATE);
  }

  if (board.writeAccessType === "PERMISSION") {
    return (
      board.writePermissionBit > 0 &&
      Permissions.has(user.permission, board.writePermissionBit)
    );
  }

  return false;
};

/** 공식 명의 사용은 게시판 이름이 아닌 별도 원자 권한으로 제어합니다. */
export const canUseOfficialIdentity = (
  _board: BoardWriteConfig,
  user: BoardUser,
): boolean =>
  hasSystemOverride(user) ||
  Permissions.has(user.permission, Permissions.POST_OFFICIAL);

/** 게시판 설정의 allowOfficialReply와 공식 답변 원자 권한을 함께 확인합니다. */
export const canWriteOfficialResponse = (
  board: Pick<BoardSummary, "allowOfficialReply">,
  user: BoardUser,
): boolean =>
  Boolean(board.allowOfficialReply) &&
  (hasSystemOverride(user) ||
    (Permissions.has(user.permission, Permissions.MANAGE_SUGGESTION_REPLY) &&
      Permissions.has(user.permission, Permissions.POST_OFFICIAL)));
