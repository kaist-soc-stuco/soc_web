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

test("late authentication errors cannot erase a newer temporary login or replace its cached session", async () => {
  const originalWindow = global.window;
  const state = new Map();
  global.window = { sessionStorage: { getItem: key => state.get(key) ?? null, setItem: (key, value) => state.set(key, value), removeItem: key => state.delete(key) } };
  try {
    for (const status of [401, 403]) {
      state.set("soc.auth.state", JSON.stringify({ temporarySession: { accessToken: "old-synthetic-token" } }));
      let rejectOld;
      const pending = new Promise((_, reject) => { rejectOld = reject; });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      try {
        const request = client.fetchQuery({ queryKey: ["auth", "session"], queryFn: () => getAuthSessionSummary({ getSession: () => pending }) });
        const newerSession = { ...session, storageMode: "temporary", canUsePersistentFeatures: false };
        state.set("soc.auth.state", JSON.stringify({ temporarySession: { accessToken: "new-synthetic-token" } }));
        client.setQueryData(["auth", "session"], newerSession);
        rejectOld(new ApiClientHttpError(status));
        await assert.rejects(request, error => error.status === status);
        assert.equal(JSON.parse(state.get("soc.auth.state")).temporarySession.accessToken, "new-synthetic-token");
        assert.deepEqual(client.getQueryData(["auth", "session"]), newerSession);
      } finally { client.clear(); }
    }
  } finally { if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
});
