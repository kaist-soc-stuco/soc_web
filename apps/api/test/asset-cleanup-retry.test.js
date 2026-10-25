const assert = require("node:assert/strict");
const { test } = require("node:test");
const { AssetService } = require("../dist/apps/api/src/features/asset/asset.service.js");

test("failed storage deletion survives cleanup and is retried by the next service instance", async () => {
  const jobs = new Set();
  let asset = { assetId: "1", storageKey: "synthetic://cleanup/retry" };
  const repo = {
    tryAcquireCleanupLease: async () => "lease",
    releaseCleanupLease: async () => {},
    releaseExpiredAssetUploadReservations: async () => 0,
    findPendingDeletions: async () => [...jobs].map(storageKey => ({ storageKey })),
    findUnlinkedAssetsBefore: async () => asset ? [asset] : [],
    deleteUnlinkedAsset: async () => {
      const removed = asset;
      jobs.add(removed.storageKey);
      asset = null;
      return removed;
    },
    completeStorageDeletion: async storageKey => jobs.delete(storageKey),
  };
  const config = { get: (_key, fallback) => fallback };
  const failed = new AssetService(repo, config, { delete: async () => { throw new Error("storage unavailable"); } }, {}, {});
  assert.deepEqual(await failed.cleanupUnlinkedAssets(), { scanned: 1, deleted: 0, failed: 1, olderThanHours: 24 });
  assert.equal(asset, null);
  assert.equal(jobs.size, 1);
  const calls = [];
  const recovered = new AssetService(repo, config, { delete: async key => calls.push(key) }, {}, {});
  assert.deepEqual(await recovered.cleanupUnlinkedAssets(), { scanned: 1, deleted: 1, failed: 0, olderThanHours: 24 });
  assert.deepEqual(calls, ["synthetic://cleanup/retry"]);
  assert.equal(jobs.size, 0);
});
