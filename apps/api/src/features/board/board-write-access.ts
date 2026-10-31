import { Permissions, type BoardSummary } from "@soc/contracts";

import type { UsersService } from "../users/users.service";

type BoardWritableUser = {
  id: string;
  permission: number;
};

type UserProfileLookup = Pick<UsersService, "findById" | "getStudentFeeStatus">;

const isSchoolOfComputingPrimaryMajor = (value?: string | null): boolean => {
  const normalized = (value ?? "").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
  return (
    normalized.includes("전산학부") ||
    normalized.includes("전산학과") ||
    normalized.includes("school of computing") ||
    normalized.includes("computer science")
  );
};

/**
 * 게시판 작성 범위를 서버에서 판정합니다.
 * 게시글/임시저장 API는 이미 AuthGuard로 로그인 사용자를 요구하므로
 * ANYONE은 추가 조건 없음, AUTHENTICATED는 명시적인 로그인 사용자 범위입니다.
 */
export async function canWriteBoard(
  board: Pick<BoardSummary, "writeAccessScope" | "writePermissionBit">,
  user: BoardWritableUser,
  usersService?: UserProfileLookup,
): Promise<boolean> {
  const scope =
    board.writeAccessScope ??
    (board.writePermissionBit > 0 ? "PERMISSION" : "AUTHENTICATED");

  switch (scope) {
    case "ANYONE":
    case "AUTHENTICATED":
      return true;
    case "PERMISSION":
      return (
        board.writePermissionBit > 0 &&
        Permissions.has(user.permission, board.writePermissionBit)
      );
    case "PRIMARY_MAJOR": {
      if (!usersService) return false;
      const profile = await usersService.findById(user.id);
      return isSchoolOfComputingPrimaryMajor(profile?.primaryMajor);
    }
    case "FEE_PAYER": {
      if (!usersService) return false;
      const feeStatus = await usersService.getStudentFeeStatus(user.id);
      return feeStatus?.status === "PAID";
    }
    default:
      return false;
  }
}
