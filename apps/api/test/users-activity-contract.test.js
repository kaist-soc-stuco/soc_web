const assert = require("node:assert/strict");
const test = require("node:test");

const {
  UsersRepository,
} = require("../dist/apps/api/src/features/users/repositories/users.repository.js");

test("My Page activity keeps comment content beside bilingual article titles", async () => {
  const occurredAt = new Date("2026-07-15T08:00:00.000Z");
  const repository = new UsersRepository(
    {
      execute: async () => ({
        rows: [
          {
            activityType: "comment",
            resourceId: "71",
            titleKo: "한국어 게시글",
            titleEn: "English post",
            commentContent: "The comment I wrote",
            occurredAt,
            articleId: "12",
            boardCode: "free",
            surveyId: null,
          },
        ],
      }),
    },
    null,
    null,
  );

  assert.deepEqual(await repository.getMyActivities("user-1", 10, 0), {
    items: [
      {
        articleId: "12",
        boardCode: "free",
        commentContent: "The comment I wrote",
        occurredAt: "2026-07-15T08:00:00.000Z",
        resourceId: "71",
        surveyId: null,
        titleKo: "한국어 게시글",
        titleEn: "English post",
        type: "comment",
      },
    ],
    total: 0,
  });
});
