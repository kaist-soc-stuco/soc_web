const assert = require("node:assert/strict");
const test = require("node:test");
const { surveyEditorErrorMessage } = require("../dist/test-src/lib/survey-editor-errors.js");

test("publication errors explain missing English question titles and choices", () => {
  assert.match(surveyEditorErrorMessage("survey_question_english_title_required", 400, "fallback"), /질문의 영문 제목/);
  assert.match(surveyEditorErrorMessage("survey_choice_requires_option", 400, "fallback"), /선택지/);
});

test("authentication and unknown errors have appropriate user-facing messages", () => {
  assert.match(surveyEditorErrorMessage(undefined, 401, "fallback"), /다시 로그인/);
  assert.equal(surveyEditorErrorMessage("unknown_internal_error", 500, "다시 시도해 주세요."), "다시 시도해 주세요.");
});
