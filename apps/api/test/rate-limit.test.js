const assert = require("node:assert/strict");
const test = require("node:test");
const { RequestRateLimitService } = require("../dist/apps/api/src/infrastructure/redis/request-rate-limit.service.js");

const request = (path) => ({ path, ip: "10.0.0.25" });

test("students sharing an IP have independent authenticated budgets", async () => {
  const counters = new Map();
  const service = new RequestRateLimitService({
    eval: async (_script, _count, key) => {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return count;
    },
  });
  for (let index = 0; index < 100; index += 1) {
    const result = await service.checkAuthenticated(request("/v1/surveys"), `student-${index}`);
    assert.equal(result.allowed, true);
  }
  for (let index = 1; index < 45; index += 1) {
    assert.equal((await service.checkAuthenticated(request("/v1/surveys"), "student-0")).allowed, true);
  }
  assert.equal((await service.checkAuthenticated(request("/v1/surveys"), "student-0")).allowed, false);
  assert.equal((await service.checkAuthenticated(request("/v1/surveys"), "student-1")).allowed, true);
  assert.ok([...counters.keys()].every(key => key.includes(":user:") && !key.includes("student-")));
});

test("calendar, search and session polling have separate per-user budgets", async () => {
  const keys = [];
  const service = new RequestRateLimitService({eval:async (_script,_count,key) => {keys.push(key); return 1;}});
  const calendar = await service.checkAuthenticated(request("/v1/calendar/search"), "student-1");
  const search = await service.checkAuthenticated(request("/v1/articles/search"), "student-1");
  const session = await service.checkAuthenticated(request("/v1/auth/session"), "student-1");
  assert.deepEqual([calendar.category,search.category,session.category], ["calendar","search","auth_read"]);
  assert.equal(new Set(keys).size,3);
});

test("Redis failure keeps authenticated writes closed and read fallback bounded", async () => {
  const service = new RequestRateLimitService({eval:async () => {throw new Error("redis unavailable");}});
  const auth = await service.checkAuthenticated(request("/v1/auth/refresh"), "student-1");
  assert.equal(auth.allowed,false);
  assert.equal(auth.unavailable,true);
  for (let index=0; index<10_050; index+=1) {
    const result = await service.checkAuthenticated(request("/v1/search"), `student-${index}`);
    assert.equal(result.allowed,true);
  }
  assert.ok(service.localBuckets.size<=10_000);
});
