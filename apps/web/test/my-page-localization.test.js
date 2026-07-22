const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getMyActivityDisplay,
  getMyActivityTitle,
  getMyArticleTitle,
  getMyCommentArticleTitle,
  getMyCommentDisplay,
  getMySurveyTitle,
} = require("../dist/test-src/lib/my-page-localization.js");

test("My Page titles prefer the selected language", () => {
  assert.equal(
    getMyActivityTitle("en", { titleKo: "활동", titleEn: "Activity" }),
    "Activity",
  );
  assert.equal(
    getMyArticleTitle("ko", { titleKo: "공지", titleEn: "Notice" }),
    "공지",
  );
  assert.equal(
    getMyCommentArticleTitle("en", {
      articleTitleKo: "게시글",
      articleTitleEn: "Post",
    }),
    "Post",
  );
  assert.equal(
    getMySurveyTitle("ko", {
      surveyTitleKo: "설문",
      surveyTitleEn: "Survey",
    }),
    "설문",
  );
});

test("comment activity copy keeps the body and localized article context", () => {
  assert.deepEqual(
    getMyActivityDisplay("en", {
      type: "comment",
      titleKo: "한국어 게시글",
      titleEn: "English post",
      commentContent: "  The comment I wrote  ",
    }),
    { title: "The comment I wrote", context: "English post" },
  );

  assert.deepEqual(
    getMyCommentDisplay("ko", {
      articleTitleKo: "한국어 게시글",
      articleTitleEn: "English post",
      content: "  내가 쓴 댓글  ",
    }),
    { title: "내가 쓴 댓글", context: "한국어 게시글" },
  );
});

test("non-comment activity copy continues to use its localized title", () => {
  assert.deepEqual(
    getMyActivityDisplay("en", {
      type: "post",
      titleKo: "한국어 게시글",
      titleEn: "English post",
      commentContent: null,
    }),
    { title: "English post", context: null },
  );
});

test("My Page titles explicitly fall back to the available language", () => {
  assert.equal(
    getMyActivityTitle("en", { titleKo: "한국어 활동", titleEn: null }),
    "한국어 활동",
  );
  assert.equal(
    getMyArticleTitle("ko", { titleKo: "  ", titleEn: "English article" }),
    "English article",
  );
  assert.equal(
    getMyCommentArticleTitle("en", {
      articleTitleKo: "한국어 게시글",
      articleTitleEn: null,
    }),
    "한국어 게시글",
  );
  assert.equal(
    getMySurveyTitle("en", {
      surveyTitleKo: "한국어 설문",
      surveyTitleEn: "   ",
    }),
    "한국어 설문",
  );
});
