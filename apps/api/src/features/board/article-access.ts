import { ForbiddenException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";
import type {
  ArticleAuthorSummary,
  ArticleDetailResponse,
  ArticleListItem,
  VisibilityScope,
} from "@soc/contracts";

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

/**
 * Secret article access is an object-level decision.  Scope membership alone
 * is not sufficient: the author or explicitly delegated moderation staff must
 * be able to read the object before any related resource is returned.
 */
export const canReadSecretArticles = (user: CurrentUserContext): boolean =>
  Boolean(
    user.authenticated &&
      user.user &&
      Permissions.hasAny(
        user.user.permission,
        Permissions.WRITE_REPLY,
        Permissions.MODERATE_CONTENT,
      ),
  );

export const canReadSecretArticle = (
  article: {
    isSecret: boolean;
    authorUserId?: string;
    author?: Pick<ArticleAuthorSummary, "userId">;
  },
  user: CurrentUserContext,
): boolean => {
  if (!article.isSecret) return true;

  const authorUserId = article.authorUserId ?? article.author?.userId;
  return Boolean(
    authorUserId && user.user?.id === authorUserId,
  ) || canReadSecretArticles(user);
};

/** Anonymous identity is never part of a public article DTO. */
export const toPublicArticleAuthor = (
  author: ArticleAuthorSummary,
  isAnonymous: boolean,
): ArticleAuthorSummary =>
  isAnonymous
    ? { name: "익명" }
    : { ...author };

export const toPublicArticleListItem = (
  item: ArticleListItem,
): ArticleListItem => ({
  ...item,
  author: toPublicArticleAuthor(item.author, item.isAnonymous),
});

export const toPublicArticleDetail = (
  article: ArticleDetailResponse,
  user: CurrentUserContext = { authenticated: false },
): ArticleDetailResponse => ({
  ...article,
  author: toPublicArticleAuthor(article.author, article.isAnonymous),
  canEdit: Boolean(
    user.authenticated &&
      user.user?.id &&
      article.author.userId &&
      user.user.id === article.author.userId,
  ),
  prevArticle: article.prevArticle
    ? {
        ...article.prevArticle,
        author: toPublicArticleAuthor(
          article.prevArticle.author,
          article.prevArticle.isAnonymous,
        ),
      }
    : null,
  nextArticle: article.nextArticle
    ? {
        ...article.nextArticle,
        author: toPublicArticleAuthor(
          article.nextArticle.author,
          article.nextArticle.isAnonymous,
        ),
      }
    : null,
});

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
