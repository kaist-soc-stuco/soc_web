const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Reflector } = require("@nestjs/core");
const { Permissions } = require("@soc/contracts");
const { retentionDeadline, shiftCalendarYears, feeCoverageEnd, FinalizeRetentionSchema } = require("../dist/apps/api/src/features/privacy-retention/retention-policy.js");
const { RetentionController } = require("../dist/apps/api/src/features/privacy-retention/retention.controller.js");
const { PermissionBitsGuard } = require("../dist/apps/api/src/features/auth/guards/require-permissions.decorator.js");
const { RetentionService } = require("../dist/apps/api/src/features/privacy-retention/retention.service.js");

const now = new Date("2026-10-28T03:00:00Z");
const id = "20000000-0000-4000-8000-000000000001";
test("retention uses business completion dates and calendar years, including leap day", () => {
  const survey = retentionDeadline({ kind: "SURVEY", resourceId: id, endedAt: "2026-07-30T03:00:00Z" }, now);
  assert.equal(survey.expiresAt.toISOString(), now.toISOString());
  const event = retentionDeadline({ kind: "APPLICATION", resourceId: id, endedAt: "2026-06-01T00:00:00Z", settledAt: "2026-07-30T03:00:00Z" }, now);
  assert.equal(event.expiresAt.toISOString(), now.toISOString());
  const vote = retentionDeadline({ kind: "VOTE", resourceId: id, endedAt: "2026-06-01T00:00:00Z", objectionEndedAt: "2026-07-30T03:00:00Z" }, now);
  assert.equal(vote.expiresAt.toISOString(), now.toISOString());
  const fee = retentionDeadline({ kind: "FEE_PAYMENT", resourceId: id, endedAt: "2024-02-29T03:00:00Z", settledAt: "2024-02-01T03:00:00Z" }, now);
  assert.equal(fee.expiresAt.toISOString(), "2027-02-28T03:00:00.000Z");
  assert.equal(shiftCalendarYears(new Date("2024-02-29T03:00:00Z"), -1).toISOString(), "2023-02-28T03:00:00.000Z");
  assert.equal(feeCoverageEnd("2020-2", 6).toISOString(), "2023-06-30T23:59:59.999Z");
  assert.throws(() => feeCoverageEnd("invalid", 6), /invalid_fee_coverage/);
});

test("unconfirmed or future completion dates cannot start ordinary deletion schedules", () => {
  assert.throws(() => retentionDeadline({ kind: "SURVEY", resourceId: id, endedAt: "2027-01-01T00:00:00Z" }, now), /end_in_future/);
  assert.throws(() => retentionDeadline({ kind: "APPLICATION", resourceId: id, endedAt: "2026-01-01T00:00:00Z" }, now), /settlement_required/);
  assert.throws(() => retentionDeadline({ kind: "VOTE", resourceId: id, endedAt: "2026-01-01T00:00:00Z" }, now), /objection_end_required/);
  assert.throws(() => retentionDeadline({ kind: "VOTE", resourceId: id, endedAt: "2026-01-01T00:00:00Z", objectionEndedAt: "2027-01-01T00:00:00Z" }, now), /objection_end_in_future/);
  assert.equal(FinalizeRetentionSchema.safeParse({ kind: "SURVEY", resourceId: id, endedAt: "bad-date" }).success, false);
});

test("retention routes require privacy administration and relevant domain permissions", async () => {
  const guard = new PermissionBitsGuard(new Reflector());
  const mask = Permissions.MANAGE_USERS | Permissions.MANAGE_ROLES;
  const context = (method, permission) => ({
    getHandler: () => RetentionController.prototype[method],
    getClass: () => RetentionController,
    switchToHttp: () => ({ getRequest: () => ({ user: { id, permission } }) }),
  });
  assert.throws(() => guard.canActivate(context("list", 0)), /insufficient_permission/);
  assert.equal(guard.canActivate(context("list", mask)), true);
  assert.throws(() => guard.canActivate(context("run", mask)), /insufficient_permission/);
  const all = mask | Permissions.MANAGE_SURVEY | Permissions.MANAGE_VOTE | Permissions.MANAGE_FINANCE | Permissions.MANAGE_CONTACTS;
  assert.equal(guard.canActivate(context("run", all)), true);
  let called = false;
  const controller = new RetentionController({ finalize: async () => { called = true; } }, {}, {});
  await assert.rejects(controller.finalize({ kind: "VOTE", resourceId: id }, { user: { id, permission: mask } }), /insufficient_permission/);
  assert.equal(called, false);
});

test("scheduled cleanup respects its switch and previews never touch storage", async () => {
  const calls = [];
  const repository = { run: async dryRun => { calls.push(dryRun); return { busy: false }; } };
  const service = new RetentionService(repository, { get: () => false }, { cleanupUnlinkedAssets: async () => calls.push("assets") });
  await service.scheduledCleanup();
  assert.deepEqual(calls, []);
  await service.run(true);
  assert.deepEqual(calls, [true]);
  await service.run(false);
  assert.deepEqual(calls, [true, false, "assets"]);
});
