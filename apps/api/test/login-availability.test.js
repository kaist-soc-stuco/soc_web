const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Logger } = require("@nestjs/common");
const { AuthService } = require("../dist/apps/api/src/features/auth/auth.service.js");
const { AuthSessionService } = require("../dist/apps/api/src/features/auth/auth-session.service.js");
const { PendingLoginRepository } = require("../dist/apps/api/src/features/auth/pending-login.repository.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { UsersService } = require("../dist/apps/api/src/features/users/users.service.js");

const config = { get: key => ({
  AUTH_JWT_SECRET: "synthetic-login-test-secret",
  AUTH_PENDING_LOGIN_ENCRYPTION_KEY: "synthetic-login-test-key",
  SSO_CLIENT_ID: "synthetic-client",
  SSO_CLIENT_SECRET: "synthetic-client-secret",
  SSO_LOGIN_URL: "https://sso.invalid/authorize",
  SSO_AUTH_API_URL: "https://sso.invalid/exchange",
  SSO_REDIRECT_URI: "https://soc.invalid/api/auth/login",
})[key] };

function harness(existing = true) {
  const values = new Map();
  const redis = {
    async set(key, value) { values.set(key, value); },
    async get(key) { return values.get(key) ?? null; },
    async getdel(key) { const value = values.get(key) ?? null; values.delete(key); return value; },
    async del(key) { values.delete(key); },
  };
  const sessions = new Map();
  // Login now links the stored fee roster. Loading the optional import file
  // belongs to bootstrap, so an absent roster row must not prevent sign-in.
  const feeService = new UsersService({
    async linkInitialStudentFeeRecord(userId, stdNo) {
      assert.equal(userId, "synthetic-user");
      assert.equal(stdNo, "90990001");
      return { record: null, changed: false };
    },
  }, {});
  const users = {
    async findByKaistUid() { return existing ? { userId: "synthetic-user", isActive: true, stdNo: "90990001" } : null; },
    async updateProfileFromSso() {},
    async invalidatePermissionCache() {},
    async upsertUserFromConsent() { return { userId: "synthetic-user", isActive: true }; },
    async applyStudentFeeBootstrap(userId, stdNo) { return feeService.applyStudentFeeBootstrap(userId, stdNo); },
  };
  const pending = new PendingLoginRepository(config, redis);
  const initialAdmin = { async ensureRoleForUser() {} };
  const session = new AuthSessionService(config, { async save(record) { sessions.set(record.sessionId, record); } }, pending, users, initialAdmin);
  const service = new AuthService(config, users, session, pending, initialAdmin, redis);
  return { service, session, sessions, users, redis };
}

function mockResponse(t, start, override = {}) {
  t.mock.method(global, "fetch", async () => new Response(JSON.stringify({
    nonce: start.nonce,
    userInfo: { user_id: "synthetic-subject", email: "synthetic@example.invalid", std_no: "90990001" },
    ...override,
  }), { status: 200 }));
}

function unavailableFees(t, contents) {
  const previous = process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "soc-login-fees-"));
  const file = path.join(directory, "fees.json");
  if (contents !== undefined) fs.writeFileSync(file, contents);
  process.env.STUDENT_FEE_BOOTSTRAP_PATH = file;
  t.after(() => {
    if (previous === undefined) delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
    else process.env.STUDENT_FEE_BOOTSTRAP_PATH = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  t.mock.method(Logger.prototype, "warn", () => {});
}

for (const contents of [undefined, "invalid-json"]) {
  const kind = contents === undefined ? "missing" : "malformed";
  test(`existing user completes login with ${kind} fee file`, async t => {
    unavailableFees(t, contents);
    const { service, sessions } = harness();
    const start = await service.createLoginStartPayload();
    mockResponse(t, start);
    const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
    assert.match(result.redirectUrl, /status=success/);
    assert.equal(sessions.size, 1);
    const login = await service.consumeLoginResult(result.transactionToken);
    assert.equal(login.userId, "synthetic-user");
    assert.equal(login.storageMode, "persisted");
    await assert.rejects(service.consumeLoginResult(result.transactionToken), /login_transaction_not_found_or_expired/);
  });

  test(`new user completes consent with ${kind} fee file`, async t => {
    unavailableFees(t, contents);
    const { service, session, sessions } = harness(false);
    const start = await service.createLoginStartPayload();
    mockResponse(t, start);
    const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
    assert.match(result.redirectUrl, /status=consent-required/);
    assert.equal(sessions.size, 0);
    const pendingLoginToken = await service.getPendingLoginToken(result.transactionToken);
    const login = await session.handleConsentDecision({ consent: true, pendingLoginToken });
    assert.equal(login.userId, "synthetic-user");
    assert.equal(login.storageMode, "persisted");
    assert.equal(sessions.size, 1);
    await assert.rejects(session.handleConsentDecision({ consent: true, pendingLoginToken }), /pending_login_not_found_or_expired/);
  });
}

for (const stage of ["state", "exchange", "profile", "account", "session"]) {
  const reasons = { state: "login_state_unavailable", exchange: "sso_exchange_failed", profile: "sso_profile_invalid", account: "login_account_failed", session: "login_session_failed" };
  test(`login reports ${stage} failures separately without logging secrets`, async t => {
    const { service, session, users, redis, sessions } = harness();
    const start = await service.createLoginStartPayload();
    mockResponse(t, start, stage === "profile" ? { userInfo: {} } : {});
    const fail = async () => { throw new Error("synthetic-secret-must-not-be-logged"); };
    if (stage === "state") redis.getdel = fail;
    if (stage === "exchange") t.mock.method(global, "fetch", fail);
    if (stage === "account") users.updateProfileFromSso = fail;
    if (stage === "session") session.issuePersistedSession = fail;
    const warnings = t.mock.method(service.logger, "warn", () => {});
    const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
    assert.equal(new URL(result.redirectUrl, "https://soc.invalid").searchParams.get("reason"), reasons[stage]);
    assert.equal(sessions.size, 0);
    assert.ok(warnings.mock.calls.every(call => !String(call.arguments[0]).includes("synthetic-secret")));
    assert.match(warnings.mock.calls[0].arguments[0], new RegExp(`at ${stage}:`));
  });
}

test("SSO HTTP errors and invalid JSON shapes fail without issuing sessions", async t => {
  for (const body of ["plain upstream error", "null", "[]"]) {
    const { service, sessions } = harness();
    const start = await service.createLoginStartPayload();
    const upstream = body === "plain upstream error";
    t.mock.method(global, "fetch", async () => new Response(body, { status: upstream ? 502 : 200 }));
    const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
    assert.match(result.redirectUrl, new RegExp(upstream ? "sso_exchange_failed" : "sso_response_invalid"));
    assert.equal(sessions.size, 0);
  }
});

for (const marker of [null, "", "  ", false]) {
  test(`SSO diagnostics preserve existing handling of empty error fields (${JSON.stringify(marker)})`, async t => {
    const { service, sessions } = harness();
    const start = await service.createLoginStartPayload();
    const warnings = t.mock.method(service.logger, "warn", () => {});
    mockResponse(t, start, { error: marker, errorCode: marker });
    const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
    assert.match(result.redirectUrl, /sso_exchange_failed/);
    assert.equal(sessions.size, 0);
    assert.match(warnings.mock.calls[0].arguments[0], /provider_error/);
  });
}

test("SSO provider errors report official diagnostic codes without logging profiles or credentials", async t => {
  const { service, sessions } = harness();
  const start = await service.createLoginStartPayload();
  const warnings = t.mock.method(service.logger, "warn", () => {});
  mockResponse(t, start, { errorCode: "ESA007", error: "server_error" });
  const result = await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state);
  assert.match(result.redirectUrl, /sso_exchange_failed/);
  assert.equal(sessions.size, 0);
  const messages = warnings.mock.calls.map(call => call.arguments[0]).join("\n");
  assert.match(messages, /ESA007/);
  assert.match(messages, /provider_error/);
  for (const secret of [start.state, start.nonce, "synthetic-code", "synthetic@example.invalid", "90990001", "synthetic-client-secret"]) assert.ok(!messages.includes(secret));
});

test("SSO HTTP rejections retain safe provider codes but never raw response text", async t => {
  const { service } = harness();
  const start = await service.createLoginStartPayload();
  const warnings = t.mock.method(service.logger, "warn", () => {});
  t.mock.method(global, "fetch", async () => new Response(JSON.stringify({ errorCode: "ESA003", error: "synthetic-secret-in-error", message: "synthetic-secret-in-body" }), { status: 403 }));
  assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state)).redirectUrl, /sso_exchange_failed/);
  const message = warnings.mock.calls.map(call => call.arguments[0]).join("\n");
  assert.match(message, /ESA003/);
  assert.match(message, /403/);
  assert.ok(!message.includes("synthetic-secret"));
});

test("SSO diagnostics keep newer machine codes and redact even code-shaped secrets", async t => {
  const { service } = harness();
  const start = await service.createLoginStartPayload();
  const warnings = t.mock.method(service.logger, "warn", () => {});
  mockResponse(t, start, { errorCode: "AUTH_IP_NOT_ALLOWED", error: "server_error" });
  assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state)).redirectUrl, /sso_exchange_failed/);
  assert.match(warnings.mock.calls[0].arguments[0], /AUTH_IP_NOT_ALLOWED/);
  const { describeSsoExchangeFailure } = require("../dist/apps/api/src/features/auth/sso-exchange-diagnostics.js");
  const message = describeSsoExchangeFailure({ kind: "provider_error", payload: { errorCode: "PRIVATE_CLIENT_KEY", error: "PRIVATE_CLIENT_KEY" }, secrets: ["PRIVATE_CLIENT_KEY"] });
  assert.ok(!message.includes("PRIVATE_CLIENT_KEY"));
  assert.match(message, /redacted/);
});

for (const code of ["ENOTFOUND", "CERT_HAS_EXPIRED", "UND_ERR_CONNECT_TIMEOUT"]) {
  test(`SSO connection diagnostics identify ${code} without exposing the exception message`, async t => {
    const { service } = harness();
    const start = await service.createLoginStartPayload();
    const warnings = t.mock.method(service.logger, "warn", () => {});
    const cause = Object.assign(new Error("synthetic-secret-in-cause"), { code });
    t.mock.method(global, "fetch", async () => { throw new TypeError("synthetic-secret-in-error", { cause }); });
    assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state)).redirectUrl, /sso_exchange_failed/);
    const message = warnings.mock.calls.map(call => call.arguments[0]).join("\n");
    assert.match(message, new RegExp(code));
    assert.ok(!message.includes("synthetic-secret"));
  });
}

test("SSO invalid HTML responses are diagnosed without logging the HTML", async t => {
  const { service } = harness();
  const start = await service.createLoginStartPayload();
  const warnings = t.mock.method(service.logger, "warn", () => {});
  t.mock.method(global, "fetch", async () => new Response("<html>synthetic-secret-in-body</html>", { headers: { "content-type": "text/html" } }));
  assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state)).redirectUrl, /sso_exchange_failed/);
  const message = warnings.mock.calls.map(call => call.arguments[0]).join("\n");
  assert.match(message, /invalid_json/);
  assert.match(message, /text\/html/);
  assert.ok(!message.includes("synthetic-secret"));
});

test("optional fee data never weakens browser, nonce or inactive-account checks", async t => {
  const { service, users, sessions } = harness();
  const start = await service.createLoginStartPayload();
  mockResponse(t, start, { nonce: "wrong-nonce" });
  assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, "wrong-cookie")).redirectUrl, /invalid_sso_transaction/);
  assert.match((await service.handleLoginCallback({ state: start.state, code: "synthetic-code" }, start.state)).redirectUrl, /nonce_mismatch/);
  const fresh = await service.createLoginStartPayload();
  mockResponse(t, fresh);
  users.findByKaistUid = async () => ({ userId: "synthetic-user", isActive: false });
  assert.match((await service.handleLoginCallback({ state: fresh.state, code: "synthetic-code" }, fresh.state)).redirectUrl, /account_expired/);
  assert.equal(sessions.size, 0);
});

for (const match of ["uid", "email"]) {
  test(`consent cannot reactivate a disabled account matched by ${match}`, async () => {
    let reads = 0;
    const tx = {
      query: { users: { async findFirst() { reads++; return match === "email" && reads === 1 ? null : { userId: "disabled-user", isActive: false }; } } },
      update() { assert.fail("Consent must not update or reactivate a disabled account"); },
      insert() { assert.fail("Consent must not replace a disabled account"); },
    };
    const repository = new UsersRepository({ async transaction(work) { return work(tx); } }, {}, config);
    await assert.rejects(repository.upsertByKaistUid({ kaistUid: "synthetic-uid", email: "synthetic@example.invalid", nameKo: "Synthetic", isActive: true }), /account_expired/);
  });
}
