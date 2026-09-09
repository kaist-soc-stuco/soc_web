const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestRateLimitService,
} = require("../dist/apps/api/src/infrastructure/redis/request-rate-limit.service.js");

function request(path, token = "anonymous") {
  return {
    path,
    ip: "10.0.0.25",
    socket: { remoteAddress: "10.0.0.25" },
    cookies: {},
    get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined,
  };
}

test("rate categories keep calendar traffic separate from search traffic and hash credentials", async () => {
  const keys = [];
  const service = new RequestRateLimitService({
    eval: async (_script, _keyCount, key) => {
      keys.push(key);
      return 1;
    },
  });

  const calendar = await service.check(request("/v1/calendar/search", "synthetic-bearer"));
  const search = await service.check(request("/v1/articles/search", "synthetic-bearer"));

  assert.equal(calendar.category, "calendar");
  assert.equal(search.category, "search");
  assert.ok(keys.every((key) => !key.includes("synthetic-bearer")));
  assert.notEqual(keys[0], keys[1]);
});

test("Redis failure fails closed for auth and uses a bounded fallback for search", async () => {
  const service = new RequestRateLimitService({
    eval: async () => { throw new Error("redis unavailable"); },
  });

  const auth = await service.check(request("/v1/auth/login"));
  const search = await service.check(request("/v1/search"));

  assert.equal(auth.allowed, false);
  assert.equal(auth.unavailable, true);
  assert.equal(search.allowed, true);
  assert.equal(search.unavailable, false);
});

test("a Redis counter beyond a route budget is rejected", async () => {
  const service = new RequestRateLimitService({
    eval: async () => 31,
  });

  const result = await service.check(request("/v1/auth/login"));

  assert.equal(result.category, "auth");
  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, false);
  assert.equal(result.remaining, 0);
});

test("read-only auth polling has its own bounded IP budget", async () => {
  const service = new RequestRateLimitService({
    eval: async () => 61,
  });

  const result = await service.check(request("/v1/auth/session", "rotated-token"));

  assert.equal(result.category, "auth_read");
  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, false);
  assert.equal(result.remaining, 0);
});

test("arbitrary bearer rotation cannot create a fresh auth budget", async () => {
  const counts = new Map();
  const service = new RequestRateLimitService({
    eval: async (_script, _keyCount, key) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    },
  });

  const results = [];
  for (let index = 0; index < 100; index += 1) {
    results.push(await service.check(request("/v1/auth/login", `forged-${index}`)));
  }

  assert.equal(results.filter((result) => result.allowed).length, 30);
  assert.equal(results.at(-1).allowed, false);
  assert.equal(counts.size, 1);
});

test("authenticated budget uses only verified user identity and fallback growth is bounded", async () => {
  const service = new RequestRateLimitService({
    eval: async () => {
      throw new Error("synthetic_redis_outage");
    },
  });

  const authenticated = await service.checkAuthenticated(
    request("/v1/search", "rotated-token"),
    "verified-user-1",
  );
  assert.equal(authenticated.allowed, true);

  for (let index = 0; index < 10_050; index += 1) {
    await service.check({
      ...request("/v1/search", `token-${index}`),
      ip: `synthetic-ip-${index}`,
      headers: { "x-forwarded-for": `forged-forwarded-ip-${index}` },
    });
  }
  assert.ok(service.localBuckets.size <= 10_000);
});
