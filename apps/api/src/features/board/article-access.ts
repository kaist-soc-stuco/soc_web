import { ForbiddenException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";
import type { VisibilityScope } from "@soc/contracts";

export interface CurrentUserContext {
  authenticated: boolean;
  user?: {
    id: string;
    permission: number;
  };
}

const STAFF_ARTICLE_PERMISSIONS = [
  Permissions.WRITE_OFFICIAL,
  Permissions.WRITE_REPLY,
  Permissions.MODERATE_CONTENT,
] as const;

export const canReadStaffArticles = (user: CurrentUserContext): boolean =>
  Boolean(
    user.authenticated &&
      user.user &&
      Permissions.hasAny(user.user.permission, ...STAFF_ARTICLE_PERMISSIONS),
  );

export const getReadableArticleScopes = (
  user: CurrentUserContext,
  allowGuestRead = true,
): VisibilityScope[] => {
  if (!user.authenticated && !allowGuestRead) return [];

  const scopes: VisibilityScope[] = ["PUBLIC"];

  if (user.authenticated) {
    scopes.push("MEMBERS");
  }

  if (canReadStaffArticles(user)) {
    scopes.push("STAFF_ONLY");
  }

  return scopes;
};

export const assertArticleScopeAssignable = (
  scope: VisibilityScope,
  user: CurrentUserContext,
): void => {
  if (scope === "STAFF_ONLY" && !canReadStaffArticles(user)) {
    throw new ForbiddenException("staff_article_permission_required");
  }
};
