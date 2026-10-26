import { and, eq, inArray, or, sql } from "drizzle-orm";
import { articles, boards } from "../../infrastructure/postgres/postgres.schema";
import { canReadSecretArticles, getReadableArticleScopes } from "./article-access";

export const secretArticleFilter = (viewerUserId?: string, allowSecretStaff = false) =>
  or(
    eq(articles.isSecret, false),
    allowSecretStaff ? eq(articles.isSecret, true)
      : viewerUserId ? eq(articles.authorUserId, viewerUserId) : sql`false`,
  );

/** Historical engagement does not grant access to the article's current data. */
export const readableArticleFilter = (userId: string, permission = 0) => {
  const viewer = { authenticated: true, user: { id: userId, permission } };
  return and(
    eq(boards.isActive, true),
    inArray(articles.visibilityScope, getReadableArticleScopes(viewer)),
    secretArticleFilter(userId, canReadSecretArticles(viewer)),
  );
};
