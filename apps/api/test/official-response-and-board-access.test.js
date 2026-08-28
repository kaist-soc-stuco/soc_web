const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");

const {
  canUseOfficialIdentity,
  canWriteOfficialResponse,
  canWriteToBoard,
} = require("../dist/apps/api/src/features/board/board-access.js");
const { CommentService } = require("../dist/apps/api/src/features/board/comment.service.js");

test("board write access is controlled by role mappings and atomic post permission", () => {
  const mappedBoard = {
    writeAccessType: "ROLE_GROUP",
    writePermissionBit: 0,
    writeRoleGroupIds: [7],
  };

  assert.equal(
    canWriteToBoard(mappedBoard, {
      id: "member",
      permission: Permissions.POST_CREATE,
      roleGroupIds: [7],
    }),
    true,
  );
  assert.equal(
    canWriteToBoard(mappedBoard, {
      id: "member",
      permission: Permissions.POST_CREATE,
      roleGroupIds: [8],
    }),
    false,
  );
  assert.equal(
    canWriteToBoard(mappedBoard, {
      id: "member",
      permission: 0,
      roleGroupIds: [7],
    }),
    false,
  );
  assert.equal(
    canWriteToBoard(
      { writeAccessType: "AUTHENTICATED", writePermissionBit: 0 },
      { id: "member", permission: Permissions.POST_CREATE },
    ),
    true,
  );
});

test("official identity and official response access use separate atomic permissions", () => {
  const board = {
    writeAccessType: "AUTHENTICATED",
    writePermissionBit: 0,
    allowOfficialReply: true,
  };

  assert.equal(
    canUseOfficialIdentity(board, {
      id: "official-writer",
      permission: Permissions.POST_OFFICIAL,
    }),
    true,
  );
  assert.equal(
    canUseOfficialIdentity(board, {
      id: "regular-writer",
      permission: Permissions.POST_CREATE,
    }),
    false,
  );
  assert.equal(
    canWriteOfficialResponse(board, {
      id: "reply-writer",
      permission:
        Permissions.MANAGE_SUGGESTION_REPLY | Permissions.POST_OFFICIAL,
    }),
    true,
  );
  assert.equal(
    canWriteOfficialResponse(board, {
      id: "reply-writer",
      permission: Permissions.MANAGE_SUGGESTION_REPLY,
    }),
    false,
  );
  assert.equal(
    canWriteOfficialResponse(
      { ...board, allowOfficialReply: false },
      {
        id: "reply-writer",
        permission:
          Permissions.MANAGE_SUGGESTION_REPLY | Permissions.POST_OFFICIAL,
      },
    ),
    false,
  );
});

test("comments-disabled boards accept only marked official responses", async () => {
  const created = [];
  const board = {
    boardId: 1,
    code: "feedback",
    isActive: true,
    allowComment: false,
    allowOfficialReply: true,
    writeAccessType: "AUTHENTICATED",
    writePermissionBit: 0,
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
  );
  const user = {
    id: "reply-writer",
    permission:
      Permissions.MANAGE_SUGGESTION_REPLY | Permissions.POST_OFFICIAL,
  };

  await assert.rejects(
    service.createComment(
      "feedback",
      "1",
      { content: "일반 댓글", isOfficial: false },
      user,
    ),
    (error) =>
      error instanceof ForbiddenException &&
      error.message === "comment_not_allowed",
  );

  await service.createComment(
    "feedback",
    "1",
    { content: "공식 답변", isOfficial: true },
    user,
  );
  assert.equal(created[0].isOfficial, true);
});
