import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

interface CurrentUserContext {
  authenticated: boolean;
  user?: {
    id: string;
    permission: number;
  };
}

interface ReadScopeSource {
  readScope: string;
  managePermissionId: number;
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

  const requiredPermission = board.managePermissionId ?? 0;
  if (!user.user || requiredPermission <= 0) {
    throw new ForbiddenException("insufficient_permission");
  }

  if ((user.user.permission & requiredPermission) !== requiredPermission) {
    throw new ForbiddenException("insufficient_permission");
  }
};

export type { CurrentUserContext };
