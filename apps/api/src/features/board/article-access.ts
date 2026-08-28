import { ForbiddenException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";
import type { VisibilityScope } from "@soc/contracts";

import type { CurrentUserContext } from "./board-access";

const STAFF_ARTICLE_PERMISSIONS = [
  Permissions.MODERATE_POST_COMMENT,
  Permissions.SUPER_ADMIN,
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

export interface SecretArticlePermissionInfo {
  authorUserId: string;
  isSecret: boolean;
}

/**
 * Secret-post access is checked after the visibility-scope query as well.
 * Keeping this separate prevents callers that already have an article id
 * (comments, reactions, edits, and moderation) from bypassing the secret flag.
 */
export const canReadSecretArticle = (
  article: SecretArticlePermissionInfo,
  user: CurrentUserContext,
): boolean => {
  if (!article.isSecret) return true;
  if (user.user?.id === article.authorUserId) return true;
  return Boolean(
    user.user &&
      Permissions.hasAny(
        user.user.permission,
        Permissions.VIEW_SECRET_POST,
        Permissions.SUPER_ADMIN,
      ),
  );
};

export const assertSecretArticleAccess = (
  article: SecretArticlePermissionInfo,
  user: CurrentUserContext,
): void => {
  if (!canReadSecretArticle(article, user)) {
    throw new ForbiddenException("secret_article_access_denied");
  }
};

export const assertArticleScopeAssignable = (
  scope: VisibilityScope,
  user: CurrentUserContext,
): void => {
  if (scope === "STAFF_ONLY" && !canReadStaffArticles(user)) {
    throw new ForbiddenException("staff_article_permission_required");
  }
};
