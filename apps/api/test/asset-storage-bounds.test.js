const assert = require("node:assert/strict");
const test = require("node:test");

const {
  S3AssetStorageProvider,
} = require("../dist/apps/api/src/features/asset/asset.storage.js");

function createProvider() {
  const values = {
    AWS_S3_BUCKET: "synthetic-test-bucket",
    AWS_REGION: "us-east-1",
  };
  const config = {
    get(name, fallback) {
      return values[name] ?? fallback;
    },
  };
  return new S3AssetStorageProvider(config);
}

test("S3 buffered reads do not fall back to an unbounded transformToByteArray", async () => {
  const provider = createProvider();
  let transformCalled = false;
  provider.client.send = async () => ({
    Body: {
      transformToByteArray: async () => {
        transformCalled = true;
        return Buffer.from("must-not-buffer");
      },
    },
  });

  await assert.rejects(
    provider.read("s3://synthetic-test-bucket/assets/example.bin"),
    /asset_s3_body_unsupported/,
  );
  assert.equal(transformCalled, false);
});

test("S3 async body reads stop at the byte cap", async () => {
  const provider = createProvider();
  let destroyed = false;
  const body = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(20 * 1024 * 1024);
      yield Buffer.from("overflow");
    },
    destroy() {
      destroyed = true;
    },
  };
  provider.client.send = async () => ({ Body: body });

  await assert.rejects(
    provider.read("s3://synthetic-test-bucket/assets/example.bin"),
    /asset_s3_body_too_large/,
  );
  assert.equal(destroyed, true);
});
