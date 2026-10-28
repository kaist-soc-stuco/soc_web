const assert = require("node:assert/strict");
const test = require("node:test");

const { getDraftStorageKey, purgeExpiredDrafts, readDraftStorage, DRAFT_RETENTION_MS } = require("../dist/test-src/lib/draft-storage.js");

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

test("survey drafts change namespace across temporary account sessions without using credentials", () => {
  const previousWindow = global.window;
  global.window = {
    sessionStorage: makeStorage(),
  };

  try {
    const first = getDraftStorageKey("survey-response", "survey-1", {
      authenticated: true,
      storageMode: "temporary",
      draftNamespace: "opaque-session-a",
    });
    const second = getDraftStorageKey("survey-response", "survey-1", {
      authenticated: true,
      storageMode: "temporary",
      draftNamespace: "opaque-session-b",
    });

    assert.notEqual(first, second);
    assert.equal(first.includes("opaque-session-a"), true);
    assert.equal(first.includes("Bearer"), false);
    assert.equal(first.includes("user-a"), false);
    assert.equal(getDraftStorageKey("survey-response", "survey-1", {
      authenticated: true,
      storageMode: "temporary",
    }), null);
    assert.equal(getDraftStorageKey("survey-response", "survey-1", {
      authenticated: true,
      storageMode: "persisted",
    }), null);
  } finally {
    global.window = previousWindow;
  }
});

test("expired drafts from all session namespaces are removed without touching other site data", () => {
  const storage = makeStorage();
  const now = Date.parse("2026-10-28T03:00:00Z");
  storage.setItem("soc:draft:article:1:old-session", JSON.stringify({ updatedAt: now - DRAFT_RETENTION_MS, contentKo: "expired" }));
  storage.setItem("soc:draft:survey:1:other-session", JSON.stringify({ savedAt: new Date(now - DRAFT_RETENTION_MS - 1).toISOString(), answers: {} }));
  storage.setItem("soc:draft:article:2:current-session", JSON.stringify({ updatedAt: now - DRAFT_RETENTION_MS + 1, contentKo: "current" }));
  storage.setItem("soc:draft:invalid", "{broken");
  storage.setItem("soc:language", "ko");
  storage.setItem("soc.auth.state", "keep-auth-state");
  assert.equal(purgeExpiredDrafts(storage, now), 3);
  assert.ok(storage.getItem("soc:draft:article:2:current-session"));
  assert.equal(storage.getItem("soc:language"), "ko");
  assert.equal(storage.getItem("soc.auth.state"), "keep-auth-state");
});

test("restore paths reject expired, untimestamped and invalid drafts", () => {
  const previousWindow = global.window;
  const storage = makeStorage();
  global.window = { localStorage: storage };
  const now = Date.parse("2026-10-28T03:00:00Z");
  try {
    for (const value of [{ updatedAt: now - DRAFT_RETENTION_MS }, {}, { savedAt: "invalid" }, { updatedAt: now + 120_000 }]) {
      storage.setItem("soc:draft:test", JSON.stringify(value));
      assert.equal(readDraftStorage("soc:draft:test", now), null);
      assert.equal(storage.getItem("soc:draft:test"), null);
    }
    const current = JSON.stringify({ savedAt: new Date(now - 1).toISOString(), content: "unfinished" });
    storage.setItem("soc:draft:test", current);
    assert.equal(readDraftStorage("soc:draft:test", now), current);
  } finally { global.window = previousWindow; }
});
