const assert = require("node:assert/strict");
const test = require("node:test");

test("all client uploads use the API multipart endpoint in one request", async () => {
  const { createApiClient } = await import("@soc/api-client");
  const requests = [];
  const expected = { assetId: "42", storageKey: "asset:42", originalFilename: "fixture.txt", mimeType: "text/plain", sizeBytes: 4 };
  const api = createApiClient({ baseUrl: "https://soc.invalid/api", fetcher: async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(expected), { status: 201, headers: { "Content-Type": "application/json" } });
  } });
  const file = new File(["test"], "fixture.txt", { type: "text/plain" });
  assert.deepEqual(await api.uploadAsset(file), expected);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://soc.invalid/api/assets/upload");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.credentials, "include");
  assert.ok(requests[0].init.body instanceof FormData);
  assert.equal(await requests[0].init.body.get("file").text(), "test");
});

test("upload failures are returned directly without attempting a cloud upload", async () => {
  const { createApiClient, ApiClientHttpError } = await import("@soc/api-client");
  let requests = 0;
  const api = createApiClient({ baseUrl: "https://soc.invalid/api", fetcher: async () => {
    requests++;
    return new Response(JSON.stringify({ message: "asset_quota_exceeded" }), { status: 400 });
  } });
  await assert.rejects(api.uploadAsset(new File(["test"], "fixture.txt")), error => error instanceof ApiClientHttpError && error.code === "asset_quota_exceeded");
  assert.equal(requests, 1);
});
