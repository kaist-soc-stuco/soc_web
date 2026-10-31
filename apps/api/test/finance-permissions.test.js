const assert = require("node:assert/strict");
const test = require("node:test");
const { Reflector } = require("@nestjs/core");
const { Permissions, SaveStudentFeeRosterSchema } = require("@soc/contracts");
const { UsersController } = require("../dist/apps/api/src/features/users/users.controller.js");
const { PermissionBitsGuard } = require("../dist/apps/api/src/features/auth/guards/require-permissions.decorator.js");

const guard = new PermissionBitsGuard(new Reflector());
function allowed(method, permission) {
  return guard.canActivate({ getHandler: () => UsersController.prototype[method], getClass: () => UsersController,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: "synthetic", permission } }) }) });
}

test("finance reads, edits and downloads have separate server-side permissions", () => {
  for (const method of ["listStudentFeeRoster", "getStudentFeeRosterDetail", "listStudentsByFeeStatus", "getStudentFeePolicy", "getStudentFeeStats"]) {
    assert.equal(allowed(method, Permissions.VIEW_FINANCE), true);
    assert.equal(allowed(method, Permissions.MANAGE_FINANCE), true);
    assert.throws(() => allowed(method, 0), /insufficient_permission/);
  }
  for (const method of ["saveStudentFeeRoster", "cancelStudentFeePayment"]) {
    assert.equal(allowed(method, Permissions.MANAGE_FINANCE), true);
    assert.throws(() => allowed(method, Permissions.VIEW_FINANCE), /insufficient_permission/);
  }
  for (const method of ["exportStudentFeeRoster", "exportStudentFeeStatus"]) {
    assert.throws(() => allowed(method, Permissions.MANAGE_FINANCE), /insufficient_permission/);
    assert.throws(() => allowed(method, Permissions.EXPORT_FINANCE), /insufficient_permission/);
    assert.equal(allowed(method, Permissions.VIEW_FINANCE | Permissions.EXPORT_FINANCE), true);
  }
});

test("roster payload validation rejects duplicate IDs, negative amounts and unknown fields", () => {
  const row = { stdNo: "90990001", nameKo: "합성", admissionYear: 2026, paidSemesters: 6, paidAmount: 30000, note: null, expectedUpdatedAt: null };
  assert.equal(SaveStudentFeeRosterSchema.safeParse({ records: [row] }).success, true);
  assert.equal(SaveStudentFeeRosterSchema.safeParse({ records: [row, row] }).success, false);
  assert.equal(SaveStudentFeeRosterSchema.safeParse({ records: [{ ...row, paidAmount: -1 }] }).success, false);
  assert.equal(SaveStudentFeeRosterSchema.safeParse({ records: [{ ...row, userId: "other" }] }).success, false);
});
