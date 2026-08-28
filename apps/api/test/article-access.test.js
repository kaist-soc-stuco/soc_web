const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");

const {
  assertSecretArticleAccess,
  assertArticleScopeAssignable,
  canReadSecretArticle,
  canReadStaffArticles,
  getReadableArticleScopes,
} = require("../dist/apps/api/src/features/board/article-access.js");

const anonymous = { authenticated: false };
const member = {
  authenticated: true,
  user: { id: "member-1", permission: 0 },
};
const contentManager = {
  authenticated: true,
  user: { id: "staff-1", permission: Permissions.MODERATE_POST_COMMENT },
};

test("anonymous users can read only public articles", () => {
  assert.deepEqual(getReadableArticleScopes(anonymous), ["PUBLIC"]);
  assert.equal(canReadStaffArticles(anonymous), false);
});

test("authenticated members can read public and member articles", () => {
  assert.deepEqual(getReadableArticleScopes(member), ["PUBLIC", "MEMBERS"]);
  assert.equal(canReadStaffArticles(member), false);
});

test("content managers can read staff-only articles", () => {
  assert.deepEqual(getReadableArticleScopes(contentManager), [
    "PUBLIC",
    "MEMBERS",
    "STAFF_ONLY",
  ]);
  assert.doesNotThrow(() =>
    assertArticleScopeAssignable("STAFF_ONLY", contentManager),
  );
});

test("regular members cannot assign staff-only visibility", () => {
  assert.throws(
    () => assertArticleScopeAssignable("STAFF_ONLY", member),
    ForbiddenException,
  );
  assert.doesNotThrow(() => assertArticleScopeAssignable("MEMBERS", member));
});

test("secret articles require the dedicated secret-post permission", () => {
  const secret = { authorUserId: "author-1", isSecret: true };
  const moderatorWithoutSecretAccess = {
    authenticated: true,
    user: {
      id: "moderator-1",
      permission: Permissions.MODERATE_POST_COMMENT,
    },
  };

  assert.equal(canReadSecretArticle(secret, anonymous), false);
  assert.equal(
    canReadSecretArticle(secret, moderatorWithoutSecretAccess),
    false,
  );
  assert.throws(
    () => assertSecretArticleAccess(secret, moderatorWithoutSecretAccess),
    (error) =>
      error instanceof ForbiddenException &&
      error.message === "secret_article_access_denied",
  );
  assert.doesNotThrow(() =>
    assertSecretArticleAccess(secret, {
      authenticated: true,
      user: { id: "secret-reader", permission: Permissions.VIEW_SECRET_POST },
    }),
  );
  assert.doesNotThrow(() =>
    assertSecretArticleAccess(secret, {
      authenticated: true,
      user: { id: "author-1", permission: 0 },
    }),
  );
});
