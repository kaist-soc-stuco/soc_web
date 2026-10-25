const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { BadRequestException, Controller, Get, Module, ServiceUnavailableException } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const express = require("express");
const base = "../dist/apps/api/src/";
const { HealthController } = require(base + "features/health/health.controller.js");
const { HealthService } = require(base + "features/health/health.service.js");
const { AllExceptionsFilter } = require(base + "shared/filters/all-exceptions.filter.js");
const { RequestIdMiddleware } = require(base + "shared/middleware/request-id.middleware.js");
let app, origin, postgresDown = false, redisDown = false;
const logs = [];

before(async () => {
  const health = new HealthService(
    { execute: async () => { if (postgresDown) throw new Error("database-secret"); } },
    { status: "ready", ping: async () => { if (redisDown) throw new Error("redis-secret"); return "PONG"; } },
  );
  health.logger.error = message => logs.push(message);
  class FailureController {
    crash() { throw new Error("synthetic-password and raw private response"); }
    invalid() { throw new BadRequestException({ message: "Validation failed", errors: [{ field: "title", message: "Required" }] }); }
    unavailable() { throw new ServiceUnavailableException("rate_limit_unavailable"); }
  }
  Controller("failure")(FailureController);
  for (const name of ["crash", "invalid", "unavailable"]) Get(name)(FailureController.prototype, name, Object.getOwnPropertyDescriptor(FailureController.prototype, name));
  class TestModule {}
  Module({ controllers: [HealthController, FailureController], providers: [{ provide: HealthService, useValue: health }] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false, bodyParser: false });
  app.use(new RequestIdMiddleware().use);
  app.use(express.json({ limit: "1kb" }));
  const filter = new AllExceptionsFilter();
  filter.logger.error = (message, frames) => logs.push(`${message}\n${frames ?? ""}`);
  filter.logger.warn = message => logs.push(message);
  app.useGlobalFilters(filter);
  await app.listen(0, "127.0.0.1");
  origin = `http://127.0.0.1:${app.getHttpServer().address().port}`;
});
after(async () => { await app?.close(); });

test("healthy dependency probes return 200 and share the server-generated request id", async () => {
  const response = await fetch(`${origin}/health`, { headers: { "x-request-id": "untrusted-client-value" } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.correlationId, response.headers.get("x-request-id"));
  assert.match(body.correlationId, /^[0-9a-f-]{36}$/);
});

test("PostgreSQL and Redis failures each return 503 with the matching log id", async () => {
  for (const dependency of ["postgres", "redis"]) {
    postgresDown = dependency === "postgres";
    redisDown = dependency === "redis";
    try {
      const response = await fetch(`${origin}/health`);
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.equal(body.status, "degraded");
      assert.equal(body.correlationId, response.headers.get("x-request-id"));
      assert.ok(logs.some(log => log.includes(`dependency=${dependency}`) && log.includes(body.correlationId)));
      assert.equal(JSON.stringify(body).includes("secret"), false);
    } finally { postgresDown = false; redisDown = false; }
  }
});

test("unexpected exceptions expose a request id and log source frames without private values", async () => {
  const response = await fetch(`${origin}/failure/crash?token=private-query-value`);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.message, "Internal server error");
  assert.equal(body.path, "/failure/crash");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
  const log = logs.find(line => line.includes(body.requestId));
  assert.ok(log.includes("FailureController.crash"));
  assert.equal(`${JSON.stringify(body)}${log}`.includes("private-query-value"), false);
  assert.equal(`${JSON.stringify(body)}${log}`.includes("synthetic-password"), false);
});

test("expected HTTP errors retain business codes and validation details with trace ids", async () => {
  const invalid = await fetch(`${origin}/failure/invalid`);
  const body = await invalid.json();
  assert.equal(invalid.status, 400);
  assert.equal(body.message, "Validation failed");
  assert.deepEqual(body.errors, [{ field: "title", message: "Required" }]);
  assert.ok(logs.some(log => log.includes(body.requestId)));
  const unavailable = await fetch(`${origin}/failure/unavailable`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).message, "rate_limit_unavailable");
});

test("malformed and oversized JSON keep their 400/413 status with trace ids", async () => {
  for (const [payload, status] of [["{broken", 400], [JSON.stringify({ value: "x".repeat(2048) }), 413]]) {
    const response = await fetch(`${origin}/failure/invalid`, { method: "POST", body: payload, headers: { "content-type": "application/json" } });
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.requestId, response.headers.get("x-request-id"));
    assert.ok(logs.some(log => log.includes(body.requestId)));
  }
});
