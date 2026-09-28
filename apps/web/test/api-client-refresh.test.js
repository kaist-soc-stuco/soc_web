const assert = require("node:assert/strict");
const test = require("node:test");

const { createApiClient } = require("@soc/api-client");

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

const createLockManager = () => {
  let tail = Promise.resolve();
  return {
    request(_name, callback) {
      const result = tail.then(callback);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
};

test("API clients serialize refresh rotation across tabs", async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;
  const localStorage = createStorage();
  let refreshCalls = 0;

  localStorage.setItem("soc.auth.last-activity-at", Date.now());
  global.window = {
    localStorage,
    location: { assign() {}, href: "", origin: "https://stuco.test" },
    sessionStorage: createStorage(),
  };
  global.document = { cookie: "" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: { locks: createLockManager() },
  });

  const fetcher = async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ storageMode: "persisted" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    const first = createApiClient({ baseUrl: "/api/v1", fetcher });
    const second = createApiClient({ baseUrl: "/api/v1", fetcher });
    await Promise.all([first.refreshSession(), second.refreshSession()]);
    assert.equal(refreshCalls, 1);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

test("API clients fail closed when Web Locks are unavailable", async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;
  const localStorage = createStorage();
  let redirectedTo;
  let refreshCalls = 0;

  localStorage.setItem("soc.auth.last-activity-at", Date.now());
  global.window = {
    localStorage,
    location: {
      assign(target) { redirectedTo = target; },
      href: "",
      origin: "https://stuco.test",
      pathname: "/admin",
      search: "",
    },
    sessionStorage: createStorage(),
  };
  global.document = { cookie: "" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: {},
  });

  const fetcher = async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ storageMode: "persisted" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    const client = createApiClient({ baseUrl: "/api/v1", fetcher });
    await assert.rejects(
      client.refreshSession(),
      (error) => error.code === "refresh_coordination_unavailable",
    );
    assert.equal(refreshCalls, 0);
    assert.equal(redirectedTo, "/login?status=error&reason=session_expired");
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

test("API clients do not refresh after one hour of browser inactivity", async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;
  const localStorage = createStorage();
  let refreshCalls = 0;

  localStorage.setItem("soc.auth.last-activity-at", Date.now() - 60 * 60 * 1000);
  global.window = {
    localStorage,
    location: {
      assign() {},
      href: "",
      origin: "https://stuco.test",
      pathname: "/admin",
      search: "",
    },
    sessionStorage: createStorage(),
  };
  global.document = { cookie: "" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: { locks: createLockManager() },
  });

  try {
    const client = createApiClient({
      baseUrl: "/api/v1",
      fetcher: async () => {
        refreshCalls += 1;
        throw new Error("refresh must not run");
      },
    });
    await assert.rejects(
      client.refreshSession(),
      (error) => error.code === "idle_session_expired",
    );
    assert.equal(refreshCalls, 0);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

test("a 401 retry reuses a refresh completed by another tab", async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;
  const localStorage = createStorage();
  let releaseUnauthorized;
  let refreshCalls = 0;
  let sessionCalls = 0;

  localStorage.setItem("soc.auth.last-activity-at", Date.now());
  global.window = {
    localStorage,
    location: { assign() {}, href: "", origin: "https://stuco.test" },
    sessionStorage: createStorage(),
  };
  global.document = { cookie: "" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: { locks: createLockManager() },
  });

  const unauthorized = new Promise((resolve) => {
    releaseUnauthorized = () => resolve(new Response(null, { status: 401 }));
  });
  const fetcher = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return new Response(JSON.stringify({ storageMode: "persisted" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    if (requestUrl.endsWith("/auth/session")) {
      sessionCalls += 1;
      if (sessionCalls === 1) return unauthorized;
      return new Response(JSON.stringify({
        authenticated: true,
        canUsePersistentFeatures: true,
        requiresConsent: false,
        storageMode: "persisted",
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    const first = createApiClient({ baseUrl: "/api/v1", fetcher });
    const second = createApiClient({ baseUrl: "/api/v1", fetcher });
    const sessionPromise = first.getSession();
    await second.refreshSession();
    releaseUnauthorized();
    const session = await sessionPromise;

    assert.equal(session.authenticated, true);
    assert.equal(refreshCalls, 1);
    assert.equal(sessionCalls, 2);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

test("API clients fail closed when browser activity storage is unavailable", async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;
  let refreshCalls = 0;

  global.window = {
    localStorage: {
      getItem() { throw new Error("blocked"); },
    },
    location: { assign() {}, href: "", origin: "https://stuco.test" },
    sessionStorage: createStorage(),
  };
  global.document = { cookie: "" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: { locks: createLockManager() },
  });

  try {
    const client = createApiClient({
      baseUrl: "/api/v1",
      fetcher: async () => {
        refreshCalls += 1;
        throw new Error("refresh must not run");
      },
    });
    await assert.rejects(
      client.refreshSession(),
      (error) => error.code === "idle_session_unavailable",
    );
    assert.equal(refreshCalls, 0);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

test("logout requests survive page navigation", async () => {
  let requestInit;
  const client = createApiClient({
    baseUrl: "/api/v1",
    fetcher: async (_url, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    },
  });

  await client.logout();
  assert.equal(requestInit.keepalive, true);
});
