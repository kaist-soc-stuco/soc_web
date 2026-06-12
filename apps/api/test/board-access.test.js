const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException, UnauthorizedException } = require("@nestjs/common");

const {
  assertBoardReadable,
  canReadBoard,
} = require("../dist/apps/api/src/features/board/board-access.js");

const MANAGE_NOTICE = 1;
const publicBoard = { readScope: "PUBLIC", managePermissionBit: 0 };
const loginBoard = { readScope: "LOGIN", managePermissionBit: 0 };
const adminBoard = {
  readScope: "ADMIN",
  managePermissionBit: MANAGE_NOTICE,
};

const anonymous = { authenticated: false };
const user = { authenticated: true, user: { id: "user-1", permission: 0 } };
const manager = {
  authenticated: true,
  user: { id: "admin-1", permission: MANAGE_NOTICE },
};

test("public boards are readable without login", () => {
  assert.equal(canReadBoard(publicBoard, anonymous), true);
  assert.doesNotThrow(() => assertBoardReadable(publicBoard, anonymous));
});

test("login-only boards require any authenticated user", () => {
  assert.equal(canReadBoard(loginBoard, anonymous), false);
  assert.equal(canReadBoard(loginBoard, user), true);

  assert.throws(
    () => assertBoardReadable(loginBoard, anonymous),
    UnauthorizedException,
  );
  assert.doesNotThrow(() => assertBoardReadable(loginBoard, user));
});

test("admin boards require the matching backend permission bit", () => {
  assert.equal(canReadBoard(adminBoard, user), false);
  assert.equal(canReadBoard(adminBoard, manager), true);

  assert.throws(() => assertBoardReadable(adminBoard, user), ForbiddenException);
  assert.doesNotThrow(() => assertBoardReadable(adminBoard, manager));
});
