import { ForbiddenException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";
import type { VisibilityScope } from "@soc/contracts";

import type { CurrentUserContext } from "./board-access";

const STAFF_ARTICLE_PERMISSIONS = [
  Permissions.MANAGE_CONTENT,
  Permissions.MODERATOR,
  Permissions.ADMIN,
] as const;

export const canReadStaffArticles = (user: CurrentUserContext): boolean =>
  Boolean(
    user.authenticated &&
      user.user &&
      Permissions.hasAny(user.user.permission, ...STAFF_ARTICLE_PERMISSIONS),
  );

export const getReadableArticleScopes = (
  user: CurrentUserContext,
): VisibilityScope[] => {
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
