const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getBoardDescriptionFromMetadata,
  getBoardTitleFromMetadata,
  getBoardWritePermissionBitFromMetadata,
  getFallbackBoards,
} = require("../dist/test-src/lib/board-metadata.js");

test("fallback board metadata does not grant write access", () => {
  const fallbackBoards = getFallbackBoards();

  assert.ok(fallbackBoards.length > 0);
  assert.ok(fallbackBoards.every((board) => board.writePermissionBit !== 0));
  assert.equal(
    getBoardWritePermissionBitFromMetadata(null, "건의사항"),
    Number.MAX_SAFE_INTEGER,
  );
});

test("server board metadata takes precedence over fallback labels and descriptions", () => {
  const board = {
    code: "공지",
    description: "서버에서 온 게시판 설명",
    nameEn: "Server Notice",
    nameKo: "서버 공지",
    writePermissionBit: 4,
  };

  assert.equal(getBoardTitleFromMetadata(board, "공지", "ko"), "서버 공지");
  assert.equal(
    getBoardTitleFromMetadata(board, "공지", "en"),
    "Server Notice",
  );
  assert.equal(
    getBoardDescriptionFromMetadata(board, "공지", "en"),
    "서버에서 온 게시판 설명",
  );
  assert.equal(getBoardWritePermissionBitFromMetadata(board, "공지"), 4);
});
