const assert = require("node:assert/strict");
const test = require("node:test");

test("shared workspace packages resolve through dist exports", async () => {
  const apiClient = await import("@soc/api-client");
  const contracts = await import("@soc/contracts");
  const shared = await import("@soc/shared");

  assert.equal(typeof apiClient.createApiClient, "function");
  assert.equal(typeof apiClient.ApiClientHttpError, "function");
  assert.equal(typeof contracts.CreateSurveySchema, "object");
  assert.equal(typeof shared.nowIso, "function");
});
