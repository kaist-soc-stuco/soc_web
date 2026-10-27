const assert = require("node:assert/strict");
const test = require("node:test");
const { getArticleImageLayout } = require("../dist/test-src/lib/article-image-layout.js");
const asset = (id, usageType = "IMAGE") => ({ assetId: String(id), storageKey: `asset:${id}`, usageType, sortOrder: 0, mimeType: "image/png", originalFilename: `${id}.png`, sizeBytes: 100 });

test("a body image used as the list thumbnail stays inline without a duplicate poster or attachment", () => {
  const layout = getArticleImageLayout({ assets: [asset(1), asset(2)], thumbnailStorageKey: "asset:1", contentKo: '<p>Before</p><img src="/api/assets/1/content"><p>Between</p><img src="asset:2"><p>After</p>' });
  assert.equal(layout.posterStorageKey, null);
  assert.equal(layout.posterAsset, undefined);
  assert.deepEqual(layout.attachmentAssets, []);
});

test("separate thumbnails and file attachments retain their roles", () => {
  const layout = getArticleImageLayout({ assets: [asset(1), asset(2, "THUMBNAIL"), asset(3, "ATTACHMENT")], thumbnailStorageKey: "asset:2", contentKo: '<img src="asset:1">' });
  assert.equal(layout.posterAsset.assetId, "2");
  assert.equal(layout.posterStorageKey, "asset:2");
  assert.deepEqual(layout.attachmentAssets.map(a => a.assetId), ["3"]);
});

test("both languages and absolute/versioned image URLs exclude inline images from the poster fallback", () => {
  const layout = getArticleImageLayout({ assets: [asset(1), asset(2)], thumbnailStorageKey: "asset:1", contentKo: "<img src='https://example.test/api/v1/assets/1/content?v=2'>", contentEn: '<img src=/v1/assets/2/content>' });
  assert.equal(layout.posterStorageKey, null);
  assert.deepEqual(layout.attachmentAssets, []);
});

test("legacy standalone images still display, and an empty asset list cannot promote a known inline thumbnail", () => {
  assert.equal(getArticleImageLayout({ assets: [asset(1)], contentKo: "Legacy post" }).posterStorageKey, "asset:1");
  assert.equal(getArticleImageLayout({ thumbnailStorageKey: "asset:1", contentKo: '<img src="asset:1">' }).posterStorageKey, null);
});

test("an image uploaded as an explicit file stays downloadable even when also embedded", () => {
  const layout = getArticleImageLayout({ assets: [asset(1, "ATTACHMENT")], contentKo: '<img src="asset:1">' });
  assert.equal(layout.posterStorageKey, null);
  assert.equal(layout.attachmentAssets.length, 1);
});
