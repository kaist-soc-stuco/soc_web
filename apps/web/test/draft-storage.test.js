const assert = require("node:assert/strict");
const test = require("node:test");

const { getDraftStorageKey } = require("../dist/test-src/lib/draft-storage.js");

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
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
