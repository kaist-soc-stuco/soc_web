const assert = require("node:assert/strict");
const test = require("node:test");
const { UnauthorizedException } = require("@nestjs/common");

const {
  AuthSessionService,
} = require("../dist/apps/api/src/features/auth/auth-session.service.js");
const {
  AuthService,
} = require("../dist/apps/api/src/features/auth/auth.service.js");
const {
  AuthCookieService,
} = require("../dist/apps/api/src/features/auth/auth-cookie.service.js");

const config = {
  get(name) {
    if (name === "AUTH_JWT_SECRET") return "synthetic-hardening-secret";
    if (name === "AUTH_PENDING_LOGIN_ENCRYPTION_KEY") return "synthetic-pending-key";
    if (name === "SSO_CLIENT_ID") return "synthetic-client";
    if (name === "SSO_LOGIN_URL") return "https://sso.invalid/login";
    if (name === "SSO_REDIRECT_URI") return "https://soc.invalid/v1/auth/login";
    if (name === "SSO_AUTH_API_URL") return "https://sso.invalid/token";
    if (name === "SSO_CLIENT_SECRET") return "synthetic-client-secret";
    return undefined;
  },
};

function createSessionRepository() {
  const records = new Map();
  return {
    records,
    async save(record) {
      records.set(record.sessionId, { ...record });
    },
    async findBySessionId(sessionId) {
      const record = records.get(sessionId);
      return record ? { ...record } : null;
    },
    async rotate(sessionId, expectedJti, replacement) {
      const current = records.get(sessionId);
      if (!current || current.revoked || current.refreshJti !== expectedJti) return false;
      records.set(sessionId, { ...replacement });
      return true;
    },
    async revoke(sessionId) {
      const current = records.get(sessionId);
      if (current) records.set(sessionId, { ...current, revoked: true });
    },
  };
}

function createUsersService() {
  return {
    async findById(userId) {
      return {
        userId,
        isActive: true,
        nameKo: "합성 사용자",
        nameEn: null,
        email: "synthetic@example.invalid",
        stdNo: null,
        departmentKo: null,
        departmentEn: null,
        primaryMajor: null,
        academicStatus: null,
      };
    },
    async resolvePermissionBitmaskByUserId() { return 0; },
    async getStudentFeeStatus() { return null; },
    async applyStudentFeeBootstrap() { return null; },
  };
}

test("persisted access tokens require the active Redis session and carry sid", async () => {
  const repository = createSessionRepository();
  const service = new AuthSessionService(
    config,
    repository,
    { consume: async () => null },
    createUsersService(),
    { ensureRoleForUser: async () => undefined },
  );

  const issued = await service.issuePersistedSession("user-a");
  const claims = service.validateAccessToken(issued.accessToken);
  assert.equal(claims.sid, issued.session.sessionId);
  assert.equal((await service.getCurrentUser(issued.accessToken)).authenticated, true);

  await repository.revoke(issued.session.sessionId);
  await assert.rejects(
    () => service.getCurrentUser(issued.accessToken),
    (error) => error instanceof UnauthorizedException && error.message === "session_expired_or_revoked",
  );
});

test("draft namespaces are opaque and change across authenticated sessions", async () => {
  const repository = createSessionRepository();
  const service = new AuthSessionService(
    config,
    repository,
    { consume: async () => null },
    createUsersService(),
    { ensureRoleForUser: async () => undefined },
  );

  const persistedA = await service.issuePersistedSession("user-a");
  const persistedB = await service.issuePersistedSession("user-b");
  const summaryA = await service.getSession(persistedA.session.sessionId);
  const summaryB = await service.getSession(persistedB.session.sessionId);
  assert.ok(summaryA.draftNamespace);
  assert.ok(summaryB.draftNamespace);
  assert.notEqual(summaryA.draftNamespace, summaryB.draftNamespace);
  assert.equal(summaryA.draftNamespace.includes(persistedA.session.sessionId), false);

  const temporaryA = await service.issueTemporarySession({
    expiresAt: Date.now() + 60_000,
    ssoSubject: "temporary-a",
    kaistUid: "temporary-a",
    nameKo: "임시 A",
    email: "temporary-a@example.invalid",
  });
  const temporaryB = await service.issueTemporarySession({
    expiresAt: Date.now() + 60_000,
    ssoSubject: "temporary-b",
    kaistUid: "temporary-b",
    nameKo: "임시 B",
    email: "temporary-b@example.invalid",
  });
  const temporarySummaryA = await service.getSession(undefined, temporaryA.accessToken);
  const temporarySummaryB = await service.getSession(undefined, temporaryB.accessToken);
  assert.ok(temporarySummaryA.draftNamespace);
  assert.ok(temporarySummaryB.draftNamespace);
  assert.notEqual(temporarySummaryA.draftNamespace, temporarySummaryB.draftNamespace);
  assert.equal(temporarySummaryA.draftNamespace.includes(temporaryA.accessToken), false);
});

test("refresh rotation accepts one concurrent use of the same JTI", async () => {
  const repository = createSessionRepository();
  const service = new AuthSessionService(
    config,
    repository,
    { consume: async () => null },
    createUsersService(),
    { ensureRoleForUser: async () => undefined },
  );
  const issued = await service.issuePersistedSession("user-a");

  const outcomes = await Promise.allSettled([
    service.rotateRefreshToken(issued.refreshToken),
    service.rotateRefreshToken(issued.refreshToken),
  ]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((item) => item.status === "rejected").length, 1);
  assert.equal(repository.records.get(issued.session.sessionId).revoked, true);
});

test("persisted sessions use a sliding idle window with a 14-day absolute cap", async () => {
  const repository = createSessionRepository();
  const service = new AuthSessionService(
    config,
    repository,
    { consume: async () => null },
    createUsersService(),
    { ensureRoleForUser: async () => undefined },
  );

  const issued = await service.issuePersistedSession("user-a");
  const idleWindowMs = 3 * 24 * 60 * 60 * 1000;
  const absoluteWindowMs = 14 * 24 * 60 * 60 * 1000;
  assert.ok(issued.session.createdAt);
  assert.equal(
    issued.session.expiresAt - issued.session.createdAt,
    idleWindowMs,
  );
  assert.equal(
    issued.session.absoluteExpiresAt - issued.session.createdAt,
    absoluteWindowMs,
  );

  const absoluteExpiresAt = Date.now() + 60_000;
  repository.records.set(issued.session.sessionId, {
    ...issued.session,
    expiresAt: Date.now() + idleWindowMs,
    absoluteExpiresAt,
  });

  await service.rotateRefreshToken(issued.refreshToken);
  const rotated = repository.records.get(issued.session.sessionId);
  assert.equal(rotated.absoluteExpiresAt, absoluteExpiresAt);
  assert.ok(rotated.expiresAt <= absoluteExpiresAt);
});

test("legacy persisted sessions do not receive a new full refresh lifetime", async () => {
  const repository = createSessionRepository();
  const service = new AuthSessionService(
    config,
    repository,
    { consume: async () => null },
    createUsersService(),
    { ensureRoleForUser: async () => undefined },
  );

  const issued = await service.issuePersistedSession("user-a");
  const legacyExpiresAt = Date.now() + 60_000;
  const legacy = { ...issued.session, expiresAt: legacyExpiresAt };
  delete legacy.createdAt;
  delete legacy.absoluteExpiresAt;
  repository.records.set(issued.session.sessionId, legacy);

  await service.rotateRefreshToken(issued.refreshToken);
  const migrated = repository.records.get(issued.session.sessionId);
  assert.equal(migrated.absoluteExpiresAt, legacyExpiresAt);
  assert.ok(migrated.expiresAt <= legacyExpiresAt);
});

test("consent consumes the pending login atomically", async () => {
  let consumed = 0;
  const pendingUser = {
    expiresAt: Date.now() + 60_000,
    ssoSubject: "subject-a",
    kaistUid: "uid-a",
    nameKo: "합성 사용자",
    email: "synthetic@example.invalid",
  };
  const pending = {
    async consume() {
      consumed += 1;
      return consumed === 1 ? pendingUser : null;
    },
  };
  const service = new AuthSessionService(
    config,
    createSessionRepository(),
    pending,
    {
      ...createUsersService(),
      async upsertUserFromConsent() { return { userId: "user-a" }; },
    },
    { ensureRoleForUser: async () => undefined },
  );

  const outcomes = await Promise.allSettled([
    service.handleConsentDecision({ consent: false, pendingLoginToken: "opaque-a" }),
    service.handleConsentDecision({ consent: false, pendingLoginToken: "opaque-a" }),
  ]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((item) => item.status === "rejected").length, 1);
});

test("SSO callback requires the browser transaction and does not put it in redirect URL", async () => {
  const values = new Map();
  const redis = {
    async set(key, value) { values.set(key, value); },
    async get(key) { return values.get(key) ?? null; },
    async getdel(key) {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    },
    async del(key) { values.delete(key); },
  };
  const users = {
    ...createUsersService(),
    async findByKaistUid() { return { userId: "user-a", isActive: true }; },
    async updateProfileFromSso() {},
    async invalidatePermissionCache() {},
  };
  const session = new AuthSessionService(
    config,
    createSessionRepository(),
    { consume: async () => null },
    users,
    { ensureRoleForUser: async () => undefined },
  );
  const service = new AuthService(
    config,
    users,
    session,
    { save: async () => undefined },
    { ensureRoleForUser: async () => undefined },
    redis,
  );
  const start = await service.createLoginStartPayload();
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    nonce: start.nonce,
    userInfo: {
      user_id: "subject-a",
      kaist_uid: "uid-a",
      user_nm: "합성 사용자",
      email: "synthetic@example.invalid",
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const callback = await service.handleLoginCallback(
      { state: start.state, code: "synthetic-code" },
      start.state,
    );
    assert.equal(new URL(callback.redirectUrl, "https://soc.invalid").searchParams.has("resultToken"), false);
    assert.ok(callback.transactionToken);
    const replay = await service.handleLoginCallback(
      { state: start.state, code: "synthetic-code" },
      start.state,
    );
    assert.match(replay.redirectUrl, /invalid_or_expired_state/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("SSO callback accepts the documented minimal Pass-Ni userInfo response", async () => {
  const values = new Map();
  const redis = {
    async set(key, value) { values.set(key, value); },
    async get(key) { return values.get(key) ?? null; },
    async getdel(key) {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    },
    async del(key) { values.delete(key); },
  };
  let lookedUpKaistUid;
  let syncedProfile;
  const users = {
    ...createUsersService(),
    async findByKaistUid(value) {
      lookedUpKaistUid = value;
      return { userId: "user-a", isActive: true };
    },
    async updateProfileFromSso(_userId, input) {
      syncedProfile = input;
    },
    async invalidatePermissionCache() {},
  };
  const session = new AuthSessionService(
    config,
    createSessionRepository(),
    { consume: async () => null },
    users,
    { ensureRoleForUser: async () => undefined },
  );
  const service = new AuthService(
    config,
    users,
    session,
    { save: async () => undefined },
    { ensureRoleForUser: async () => undefined },
    redis,
  );
  const start = await service.createLoginStartPayload();
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    nonce: start.nonce,
    userInfo: {
      user_id: "documented-user-id",
      user_email: "documented@example.invalid",
      user_mbtlnum: "010-0000-0000",
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const callback = await service.handleLoginCallback(
      { state: start.state, code: "synthetic-code" },
      start.state,
    );
    assert.ok(callback.transactionToken);
    assert.equal(lookedUpKaistUid, "documented-user-id");
    assert.equal(syncedProfile?.nameKo, "documented-user-id");
    assert.equal(syncedProfile?.email, "documented@example.invalid");
  } finally {
    global.fetch = originalFetch;
  }
});

test("production auth cookies remain Secure and cross-site SSO uses None", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const service = new AuthCookieService();
  const cookies = [];
  const response = {
    cookie(name, value, options) { cookies.push({ name, value, options }); },
    clearCookie() {},
  };
  service.setSsoTransactionCookie(response, "opaque-state", { secure: false });
  assert.equal(cookies[0].options.secure, true);
  assert.equal(cookies[0].options.sameSite, "none");
  process.env.NODE_ENV = previous;
});

test("development mode with HTTPS KAIST SSO also uses a cross-site transaction cookie", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLoginUrl = process.env.SSO_LOGIN_URL;
  const previousRedirectUri = process.env.SSO_REDIRECT_URI;

  process.env.NODE_ENV = "development";
  process.env.SSO_LOGIN_URL = "https://ssodev.kaist.ac.kr/auth/user/single/login/authorize";
  process.env.SSO_REDIRECT_URI = "https://soc.invalid/api/auth/login";

  try {
    const service = new AuthCookieService();
    const cookies = [];
    const response = {
      cookie(name, value, options) { cookies.push({ name, value, options }); },
      clearCookie() {},
    };

    service.setSsoTransactionCookie(response, "opaque-state", { secure: false });
    assert.equal(cookies[0].options.secure, true);
    assert.equal(cookies[0].options.sameSite, "none");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousLoginUrl === undefined) delete process.env.SSO_LOGIN_URL;
    else process.env.SSO_LOGIN_URL = previousLoginUrl;
    if (previousRedirectUri === undefined) delete process.env.SSO_REDIRECT_URI;
    else process.env.SSO_REDIRECT_URI = previousRedirectUri;
  }
});
