import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";

interface CurrentUserContext {
  authenticated: boolean;
  user?: {
    id: string;
    permission: number;
  };
}

interface ReadScopeSource {
  readScope: string;
  managePermissionBit: number;
}

export const assertBoardReadable = (
  board: ReadScopeSource,
  user: CurrentUserContext,
): void => {
  if (board.readScope === "PUBLIC") {
    return;
  }

  if (!user.authenticated) {
    throw new UnauthorizedException("login_required");
  }

  if (board.readScope === "LOGIN") {
    return;
  }

  if (!user.user || board.managePermissionBit <= 0) {
    throw new ForbiddenException("insufficient_permission");
  }

  if (!Permissions.has(user.user.permission, board.managePermissionBit)) {
    throw new ForbiddenException("insufficient_permission");
  }
};

export type { CurrentUserContext };
