const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");

const { canWriteBoard } = require("../dist/apps/api/src/features/board/board-write-access.js");
const { CommentService } = require("../dist/apps/api/src/features/board/comment.service.js");

test("board write access follows the current board scope", async () => {
  assert.equal(
    await canWriteBoard(
      { writeAccessScope: "AUTHENTICATED", writePermissionBit: 0 },
      { id: "member", permission: 0 },
    ),
    true,
  );
  assert.equal(
    await canWriteBoard(
      { writeAccessScope: "PERMISSION", writePermissionBit: Permissions.MANAGE_BOARDS },
      { id: "manager", permission: Permissions.MANAGE_BOARDS },
    ),
    true,
  );
  assert.equal(
    await canWriteBoard(
      { writeAccessScope: "PERMISSION", writePermissionBit: Permissions.MANAGE_BOARDS },
      { id: "member", permission: 0 },
    ),
    false,
  );
});

test("the suggestions board accepts official replies with the current reply permission", async () => {
  const created = [];
  const board = {
    boardId: 1,
    code: "suggestions",
    isActive: true,
    allowComment: false,
  };
  const article = {
    allowComment: false,
    authorUserId: "student-1",
    isSecret: false,
    status: "PUBLISHED",
  };
  const service = new CommentService(
    { findByCode: async () => board },
    {
      findCommentPermissionInfo: async () => article,
    },
    {
      createComment: async (input) => {
        created.push(input);
        return { commentId: "1", createdAt: "2026-08-28T00:00:00.000Z" };
      },
      findNotificationTargets: async () => null,
    },
    { notifyCommentCreated: async () => undefined },
    { record: async () => undefined },
  );

  await assert.rejects(
    service.createComment(
      "suggestions",
      "1",
      { content: "일반 댓글" },
      { id: "member", permission: 0 },
    ),
    (error) =>
      error instanceof ForbiddenException &&
      error.message === "comment_not_allowed",
  );

  await service.createComment(
    "suggestions",
    "1",
    { content: "공식 답변" },
    { id: "reply-writer", permission: Permissions.WRITE_REPLY },
  );
  assert.equal(created[0].isOfficial, true);
});
