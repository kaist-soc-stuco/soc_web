const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  SESSION_IDLE_TIMEOUT_MS,
  idleLogoutDelay,
  initialSessionActivityAt,
  isSessionIdle,
  shouldRefreshActiveSession,
} = require("../dist/test-src/lib/session-idle.js");

test("persisted sessions become idle after one hour without activity", () => {
  const startedAt = 1_000;

  assert.equal(isSessionIdle(startedAt, startedAt + SESSION_IDLE_TIMEOUT_MS - 1), false);
  assert.equal(isSessionIdle(startedAt, startedAt + SESSION_IDLE_TIMEOUT_MS), true);
  assert.equal(idleLogoutDelay(startedAt, startedAt + 30 * 60 * 1000), 30 * 60 * 1000);
  assert.equal(initialSessionActivityAt(startedAt, startedAt + 10_000), startedAt);
  assert.equal(initialSessionActivityAt(0, startedAt), startedAt);
});

test("session refreshes are limited to active users and throttled", () => {
  const now = 60 * 60 * 1000;

  assert.equal(shouldRefreshActiveSession(now - 1_000, now - 10 * 60 * 1000, now), true);
  assert.equal(shouldRefreshActiveSession(now - 1_000, now - 60_000, now), false);
  assert.equal(shouldRefreshActiveSession(0, now - 10 * 60 * 1000, now), false);
});

test("browser session coordination preserves stored activity across reloads", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/App.tsx"),
    "utf8",
  );

  assert.match(source, /session\.draftNamespace/);
  assert.match(source, /initialSessionActivityAt\(storedActivityAt, nowMs\(\)\)/);
  assert.match(source, /if \(storedActivityAt === undefined\)/);
  assert.match(source, /function writeSharedTimestamp/);
  assert.doesNotMatch(source, /const initialActivityAt = nowMs\(\)/);
  assert.doesNotMatch(source, /await apiClient\.logout\(\)/);
});
