const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");
const { ArticleCreateSchema } = require("@soc/contracts");

const {
  assertArticleScopeAssignable,
  canReadSecretArticle,
  canReadSecretArticles,
  canReadStaffArticles,
  getReadableArticleScopes,
  toPublicArticleDetail,
} = require("../dist/apps/api/src/features/board/article-access.js");

const anonymous = { authenticated: false };
const member = {
  authenticated: true,
  user: { id: "member-1", permission: 0 },
};
const contentManager = {
  authenticated: true,
  user: { id: "staff-1", permission: Permissions.MODERATE_CONTENT },
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

test("secret article access is bound to the author or delegated staff", () => {
  const secret = { isSecret: true, authorUserId: "author-1" };
  assert.equal(canReadSecretArticle(secret, anonymous), false);
  assert.equal(canReadSecretArticle(secret, member), false);
  assert.equal(
    canReadSecretArticle(secret, { authenticated: true, user: { id: "author-1", permission: 0 } }),
    true,
  );
  assert.equal(canReadSecretArticles(contentManager), true);
});

test("public article DTOs do not expose anonymous author identity", () => {
  const article = {
    articleId: "1",
    boardId: 1,
    titleKo: "제목",
    contentKo: "내용",
    status: "PUBLISHED",
    visibilityScope: "PUBLIC",
    isPinned: false,
    isSecret: false,
    postedAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    author: { userId: "author-1", name: "홍길동" },
    isAnonymous: true,
    allowComment: true,
    assets: [],
    commentCount: 0,
    viewCount: 0,
    likeCount: 0,
    scrapCount: 0,
    viewerHasLiked: false,
    viewerHasScrapped: false,
    prevArticle: {
      articleId: "2",
      titleKo: "이전",
      postedAt: "2026-09-07T00:00:00.000Z",
      author: { userId: "author-2", name: "김철수" },
      isAnonymous: true,
    },
    nextArticle: null,
  };
  const detail = toPublicArticleDetail(article, anonymous);
  assert.deepEqual(detail.author, { name: "익명" });
  assert.deepEqual(detail.prevArticle?.author, { name: "익명" });
  assert.equal(detail.canEdit, false);
  assert.equal("userId" in detail.author, false);
  assert.equal("userId" in (detail.prevArticle?.author ?? {}), false);

  assert.equal(
    toPublicArticleDetail(article, {
      authenticated: true,
      user: { id: "author-1", permission: 0 },
    }).canEdit,
    true,
  );
  assert.equal(
    toPublicArticleDetail(article, {
      authenticated: true,
      user: { id: "other-user", permission: 0 },
    }).canEdit,
    false,
  );
});

test("article assets accept an empty list while retaining count and duplicate checks", () => {
  const base = {
    titleKo: "첨부 없는 글",
    contentKo: "본문",
    visibilityScope: "PUBLIC",
    assets: [],
  };
  assert.deepEqual(ArticleCreateSchema.parse(base).assets, []);
  assert.throws(
    () => ArticleCreateSchema.parse({
      ...base,
      assets: Array.from({ length: 51 }, (_, index) => ({
        assetId: String(index + 1),
        usageType: "ATTACHMENT",
        sortOrder: index,
      })),
    }),
    /article_assets_too_many/,
  );
  assert.throws(
    () => ArticleCreateSchema.parse({
      ...base,
      assets: [
        { assetId: "1", usageType: "ATTACHMENT", sortOrder: 0 },
        { assetId: "1", usageType: "IMAGE", sortOrder: 1 },
      ],
    }),
    /duplicate_asset_id/,
  );
});
