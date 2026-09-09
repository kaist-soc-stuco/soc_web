const assert = require("node:assert/strict");
const test = require("node:test");

const {
  HealthService,
} = require("../dist/apps/api/src/features/health/health.service.js");

function serviceWith(db, redis) {
  const service = new HealthService(db, redis);
  service.logger.error = () => {};
  return service;
}

test("health exposes only status, code, correlation id, and timestamp", async () => {
  const result = await serviceWith(
    { execute: async () => {} },
    { status: "ready", ping: async () => "PONG" },
  ).getHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.code, "ok");
  assert.match(result.correlationId, /^[0-9a-f-]{36}$/);
  assert.equal(typeof result.timestamp, "string");
  assert.equal("postgres" in result, false);
  assert.equal("redis" in result, false);
});

test("health logs a correlation id without returning dependency exception text", async () => {
  const logs = [];
  const service = serviceWith(
    { execute: async () => { throw new Error("postgres-secret-value"); } },
    { status: "ready", ping: async () => { throw new Error("redis-secret-value"); } },
  );
  service.logger.error = (message) => logs.push(message);

  const result = await service.getHealth();

  assert.equal(result.status, "degraded");
  assert.equal(result.code, "dependency_unavailable");
  assert.equal(logs.length, 2);
  assert.ok(logs.every((message) => message.includes(result.correlationId)));
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
  assert.equal(logs.join(" ").includes("secret-value"), false);
});
