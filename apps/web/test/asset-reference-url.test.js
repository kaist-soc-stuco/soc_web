const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveAssetReferenceUrl,
} = require("../dist/test-src/lib/asset-reference-url.js");

test("protected asset references follow the configured API base", () => {
  assert.equal(
    resolveAssetReferenceUrl("asset:42", "/api"),
    "/api/assets/42/content",
  );
  assert.equal(
    resolveAssetReferenceUrl("asset:42", "http://localhost:3000"),
    "http://localhost:3000/v1/assets/42/content",
  );
  assert.equal(
    resolveAssetReferenceUrl("asset:42", "http://localhost:3000/v1"),
    "http://localhost:3000/v1/assets/42/content",
  );
});

test("legacy paths and external URLs are not reinterpreted as asset references", () => {
  assert.equal(resolveAssetReferenceUrl("/uploads/assets/file.png", "/api"), null);
  assert.equal(resolveAssetReferenceUrl("https://cdn.example/file.png", "/api"), null);
  assert.equal(resolveAssetReferenceUrl("asset:not-a-number", "/api"), null);
});
