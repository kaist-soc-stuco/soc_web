const assert = require("node:assert/strict");
const test = require("node:test");

const {
  areArticleAssetsAttachable,
} = require("../dist/apps/api/src/features/board/article-asset-access.js");

test("a new article can attach only the caller's unlinked uploads", () => {
  const common = {
    actingUserId: "author-1",
    requestedAssetIds: [1],
  };

  assert.equal(
    areArticleAssetsAttachable({
      ...common,
      assets: [{ assetId: 1, uploadedBy: "author-1" }],
      links: [],
    }),
    true,
  );
  assert.equal(
    areArticleAssetsAttachable({
      ...common,
      assets: [{ assetId: 1, uploadedBy: "other-user" }],
      links: [],
    }),
    false,
  );
  assert.equal(
    areArticleAssetsAttachable({
      ...common,
      assets: [{ assetId: 1, uploadedBy: "author-1" }],
      links: [{ articleId: 99, assetId: 1 }],
    }),
    false,
  );
});

test("an edit preserves existing assets but cannot borrow another article's asset", () => {
  const common = {
    actingUserId: "manager-1",
    assets: [{ assetId: 1, uploadedBy: "original-author" }],
    currentArticleId: 10,
    requestedAssetIds: [1],
  };

  assert.equal(
    areArticleAssetsAttachable({
      ...common,
      links: [{ articleId: 10, assetId: 1 }],
    }),
    true,
  );
  assert.equal(
    areArticleAssetsAttachable({
      ...common,
      links: [{ articleId: 11, assetId: 1 }],
    }),
    false,
  );
});

test("missing asset ids fail closed", () => {
  assert.equal(
    areArticleAssetsAttachable({
      actingUserId: "author-1",
      assets: [],
      links: [],
      requestedAssetIds: [404],
    }),
    false,
  );
});
