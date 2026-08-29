const assert = require("node:assert/strict");
const test = require("node:test");

const {
  InitialAdminService,
  parseInitialAdminStudentNumbers,
} = require("../dist/apps/api/src/features/auth/initial-admin.service.js");

test("initial administrator student numbers are unique 8-digit values", () => {
  const values = parseInitialAdminStudentNumbers(
    "20260001, 20260002\n20260001;invalid;1234",
  );

  assert.deepEqual([...values], ["20260001", "20260002"]);
});

test("configured student receives the seeded initial administrator role", async () => {
  const calls = [];
  const service = new InitialAdminService(
    { get: () => "20260001,20260002" },
    {
      ensureRoleForUser: async (userId) => {
        calls.push(["grant", userId]);
        return "granted";
      },
    },
    {
      invalidatePermissionCache: async (userId) => {
        calls.push(["invalidate", userId]);
      },
    },
  );

  assert.equal(await service.ensureRoleForUser("user-1", "20260001"), true);
  assert.deepEqual(calls, [
    ["grant", "user-1"],
    ["invalidate", "user-1"],
  ]);
});

test("non-configured student is not sent to the role repository", async () => {
  let called = false;
  const service = new InitialAdminService(
    { get: () => "20260001" },
    {
      ensureRoleForUser: async () => {
        called = true;
        return "granted";
      },
    },
    { invalidatePermissionCache: async () => undefined },
  );

  assert.equal(await service.ensureRoleForUser("user-2", "20260003"), false);
  assert.equal(called, false);
});

test("configured student fails clearly when reference seed was not applied", async () => {
  const service = new InitialAdminService(
    { get: () => "20260001" },
    { ensureRoleForUser: async () => "role_missing" },
    { invalidatePermissionCache: async () => undefined },
  );

  await assert.rejects(
    service.ensureRoleForUser("user-3", "20260001"),
    /initial_admin_role_missing_run_reference_seed/,
  );
});
