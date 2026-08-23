const assert = require("node:assert/strict");
const test = require("node:test");
const { BadRequestException } = require("@nestjs/common");

const {
  assertPublishableSurveyDefinition,
  assertSurveyQuestionDefinition,
} = require("../dist/apps/api/src/features/surveys/survey-definition-validation.js");

const question = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000101",
  sectionId: "00000000-0000-4000-8000-000000000001",
  titleKo: "질문",
  titleEn: "Question",
  descriptionKo: null,
  descriptionEn: null,
  questionType: "short_text",
  options: null,
  config: null,
  answerRegex: null,
  isRequired: true,
  sortOrder: 0,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
  ...overrides,
});

const section = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  surveyId: "00000000-0000-4000-8000-000000000000",
  titleKo: "섹션",
  titleEn: "Section",
  descriptionKo: null,
  descriptionEn: null,
  sortOrder: 0,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
  questions: [question()],
  ...overrides,
});

function expectBadRequest(fn, message) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, message);
    return true;
  });
}

test("rejects publishing an empty survey definition", () => {
  expectBadRequest(
    () => assertPublishableSurveyDefinition({ isKoreanOnly: true, titleEn: null }, []),
    "survey_requires_section",
  );
  expectBadRequest(
    () => assertPublishableSurveyDefinition({ isKoreanOnly: true, titleEn: null }, [section({ questions: [] })]),
    "survey_requires_question",
  );
});

test("requires complete options and grid axes", () => {
  expectBadRequest(
    () => assertSurveyQuestionDefinition(question({ questionType: "single_choice", options: [{ value: "a", labelKo: "A" }] })),
    "survey_choice_requires_two_options",
  );
  expectBadRequest(
    () => assertSurveyQuestionDefinition(question({ questionType: "grid_single", config: { rows: [], columns: [] } })),
    "survey_grid_requires_rows",
  );
});

test("temporarily disables file-upload questions at the backend boundary", () => {
  expectBadRequest(
    () => assertSurveyQuestionDefinition(question({ questionType: "file_upload" })),
    "survey_file_upload_temporarily_disabled",
  );
});

test("accepts a complete bilingual survey", () => {
  assert.doesNotThrow(() => assertPublishableSurveyDefinition(
    { isKoreanOnly: false, titleEn: "Survey" },
    [section()],
  ));
});
