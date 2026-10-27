const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { LocalAssetStorageProvider } = require("../dist/apps/api/src/features/asset/asset.storage.js");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "soc-local-assets-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = { get: key => key === "ASSET_UPLOAD_DIR" ? root : undefined };
  return { root, config, provider: new LocalAssetStorageProvider(config) };
}

test("disk uploads survive provider recreation and duplicate names never overwrite", async t => {
  const { provider, config, root } = await fixture(t);
  const first = Buffer.from("first upload");
  const second = Buffer.from("second upload");
  const [left, right] = await Promise.all([first, second].map(buffer => provider.upload({ buffer, contentType: "text/plain", originalName: "same.txt" })));
  assert.notEqual(left, right);
  assert.deepEqual(await fs.readFile(path.join(root, path.basename(left))), first);
  const restarted = new LocalAssetStorageProvider(config);
  assert.deepEqual(await restarted.read(left), first);
  const chunks = [];
  for await (const chunk of await restarted.readStream(right)) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), second);
  await restarted.delete(left);
  await restarted.delete(left);
  await assert.rejects(restarted.read(left), { code: "ENOENT" });
  assert.deepEqual(await restarted.read(right), second);
});

test("buffered disk reads accept 20 MiB and reject larger files", async t => {
  const { provider, root } = await fixture(t);
  const file = path.join(root, "boundary.bin");
  await fs.writeFile(file, Buffer.alloc(20 * 1024 * 1024));
  assert.equal((await provider.read("/uploads/assets/boundary.bin")).length, 20 * 1024 * 1024);
  await fs.appendFile(file, "overflow");
  await assert.rejects(provider.read("/uploads/assets/boundary.bin"), /asset_body_too_large/);
});

test("disk reads and deletes reject remote keys and traversal without aliasing local files", async t => {
  const { provider } = await fixture(t);
  const key = await provider.upload({ buffer: Buffer.from("keep"), contentType: "text/plain", originalName: "keep.txt" });
  for (const invalid of ["s3://obsolete-bucket/" + path.basename(key), "https://invalid/" + path.basename(key), "/uploads/assets/../keep.txt", "/uploads/assets/..", "/uploads/assets/", "/uploads/assets/..\\keep.txt"]) {
    await assert.rejects(provider.read(invalid), /asset_storage_key_invalid/);
    await assert.rejects(provider.readStream(invalid), /asset_storage_key_invalid/);
    await assert.rejects(provider.delete(invalid), /asset_storage_key_invalid/);
  }
  assert.equal((await provider.read(key)).toString(), "keep");
});

test("blank upload directory uses the normal uploads folder", () => {
  const provider = new LocalAssetStorageProvider({ get: () => "  " });
  assert.equal(provider.uploadDir, path.resolve(process.cwd(), "uploads", "assets"));
});
