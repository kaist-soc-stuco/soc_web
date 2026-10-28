const assert = require("node:assert/strict");
const test = require("node:test");
const { AUTH_RETURN_TO_KEY, rememberAuthReturnPath, consumeAuthReturnPath } = require("../dist/test-src/lib/auth-storage.js");

function withBrowser(run) {
  const originalWindow = global.window;
  const values = new Map();
  global.window = {
    location: { pathname: "/survey/example", search: "?source=events", hash: "#question-2" },
    sessionStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
  };
  try { run(values); }
  finally { if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
}

test("sign-in remembers the current survey including its query and question anchor", () => withBrowser(() => {
  rememberAuthReturnPath();
  assert.equal(consumeAuthReturnPath(), "/survey/example?source=events#question-2");
  assert.equal(consumeAuthReturnPath(), null);
}));

test("return destinations support voting, comments, filtered lists and protected editors", () => withBrowser(() => {
  for (const path of ["/votes/example", "/board/free/123#article-comments", "/events?state=active", "/mypage?menu=activity&page=2", "/admin/surveys/example/edit"]) {
    rememberAuthReturnPath(path);
    assert.equal(consumeAuthReturnPath(), path);
  }
}));

test("return destinations reject external URLs and authentication loops", () => withBrowser(values => {
  for (const path of ["https://example.com", "//example.com", "/\\example.com", "/login", "/login?status=success", "/nested/../login", "/api/auth/login", "/survey/\nexample"]) {
    rememberAuthReturnPath(path);
    assert.equal(values.has(AUTH_RETURN_TO_KEY), false, path);
    values.set(AUTH_RETURN_TO_KEY, path);
    assert.equal(consumeAuthReturnPath(), null, path);
    assert.equal(values.has(AUTH_RETURN_TO_KEY), false);
  }
}));

test("unavailable return-path storage does not prevent sign-in", () => withBrowser(() => {
  global.window.sessionStorage = {
    getItem() { throw new Error("storage_disabled"); },
    setItem() { throw new Error("storage_disabled"); },
    removeItem() { throw new Error("storage_disabled"); },
  };
  assert.doesNotThrow(() => rememberAuthReturnPath());
  assert.equal(consumeAuthReturnPath(), null);
}));
