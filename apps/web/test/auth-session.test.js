const assert = require("node:assert/strict");
const test = require("node:test");
const { QueryClient } = require("@tanstack/react-query");
const { ApiClientHttpError } = require("@soc/api-client");
const { getAuthSessionSummary, createEmptyAuthSession } = require("../dist/test-src/lib/auth-session.js");

const session = { authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: "persisted", userId: "test-user", permission: 1 };

for (const error of [new TypeError("Network request failed"), new ApiClientHttpError(500), new ApiClientHttpError(503)]) {
  test(`background session failure preserves cached login: ${error.message}`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["auth", "session"];
    client.setQueryData(queryKey, session);
    try {
      await assert.rejects(client.fetchQuery({ queryKey, queryFn: () => getAuthSessionSummary({ getSession: async () => { throw error; } }) }), caught => caught === error);
      assert.deepEqual(client.getQueryData(queryKey), session);
      const refreshed = { ...session, permission: 2 };
      await client.fetchQuery({ queryKey, queryFn: () => getAuthSessionSummary({ getSession: async () => refreshed }) });
      assert.deepEqual(client.getQueryData(queryKey), refreshed);
    } finally { client.clear(); }
  });
}

for (const status of [401, 403]) {
  test(`confirmed authentication failure replaces cached login: ${status}`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["auth", "session"];
    client.setQueryData(queryKey, session);
    try {
      await client.fetchQuery({ queryKey, queryFn: () => getAuthSessionSummary({ getSession: async () => { throw new ApiClientHttpError(status); } }) });
      assert.deepEqual(client.getQueryData(queryKey), createEmptyAuthSession());
    } finally { client.clear(); }
  });
}

test("explicit logged-out response is respected", async () => {
  assert.deepEqual(await getAuthSessionSummary({ getSession: async () => createEmptyAuthSession() }), createEmptyAuthSession());
});
