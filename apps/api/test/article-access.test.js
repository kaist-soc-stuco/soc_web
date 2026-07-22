const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");

const {
  assertArticleScopeAssignable,
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
  user: { id: "staff-1", permission: Permissions.MANAGE_CONTENT },
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
