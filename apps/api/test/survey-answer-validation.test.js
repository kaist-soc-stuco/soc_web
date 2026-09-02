const assert = require("node:assert/strict");
const test = require("node:test");
const { BadRequestException, ConflictException } = require("@nestjs/common");

const {
  validateSurveyAnswers,
} = require("../dist/apps/api/src/features/surveys/survey-answer-validation.js");

const NOW = Date.parse("2026-05-30T00:00:00.000Z");

function question(overrides = {}) {
  return {
    id: "question-1",
    sectionId: "section-1",
    titleKo: "질문",
    titleEn: null,
    descriptionKo: null,
    descriptionEn: null,
    questionType: "short_text",
    options: null,
    answerRegex: null,
    isRequired: true,
    editDeadlineAt: null,
    sortOrder: 1,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function expectHttpError(fn, ExceptionClass, message) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ExceptionClass);
    assert.equal(error.message, message);
    return true;
  });
}

test("accepts valid required and optional answers", () => {
  const questions = [
    question({ id: "name" }),
    question({ id: "memo", isRequired: false, questionType: "long_text" }),
  ];

  assert.doesNotThrow(() =>
    validateSurveyAnswers(
      questions,
      [
        { questionId: "name", content: { text: "홍길동" } },
        { questionId: "memo", content: {} },
      ],
      NOW,
    ),
  );
});

test("rejects missing required answer", () => {
  expectHttpError(
    () => validateSurveyAnswers([question({ id: "name" })], [], NOW),
    BadRequestException,
    "required_answer_missing",
  );
});

test("rejects duplicate answers for the same question", () => {
  expectHttpError(
    () =>
      validateSurveyAnswers(
        [question({ id: "name" })],
        [
          { questionId: "name", content: { text: "A" } },
          { questionId: "name", content: { text: "B" } },
        ],
        NOW,
      ),
    BadRequestException,
    "duplicate_answer",
  );
});

test("rejects unknown question ids", () => {
  expectHttpError(
    () =>
      validateSurveyAnswers(
        [question({ id: "known" })],
        [{ questionId: "unknown", content: { text: "A" } }],
        NOW,
      ),
    BadRequestException,
    "question_not_found",
  );
});

test("validates choice answers against defined options", () => {
  const choiceQuestion = question({
    id: "meal",
    questionType: "single_choice",
    options: [
      { value: "pizza", labelKo: "피자" },
      { value: "burger", labelKo: "버거" },
    ],
  });

  assert.doesNotThrow(() =>
    validateSurveyAnswers(
      [choiceQuestion],
      [{ questionId: "meal", content: { value: "pizza" } }],
      NOW,
    ),
  );

  expectHttpError(
    () =>
      validateSurveyAnswers(
        [choiceQuestion],
        [{ questionId: "meal", content: { value: "sushi" } }],
        NOW,
      ),
    BadRequestException,
    "answer_option_invalid",
  );
});

test("validates text answer regex", () => {
  const emailQuestion = question({
    id: "email",
    answerRegex: "^[^@]+@kaist\\.ac\\.kr$",
  });

  expectHttpError(
    () =>
      validateSurveyAnswers(
        [emailQuestion],
        [{ questionId: "email", content: { text: "person@example.com" } }],
        NOW,
      ),
    BadRequestException,
    "answer_regex_mismatch",
  );
});

test("ignores the retired question edit deadline", () => {
  assert.doesNotThrow(() =>
    validateSurveyAnswers(
      [
        question({
          id: "late",
          editDeadlineAt: "2026-05-29T23:59:59.000Z",
        }),
      ],
      [{ questionId: "late", content: { text: "still valid" } }],
    ),
  );
});

test("rejects duplicate values in multiple-choice answers", () => {
  const multiple = question({
    questionType: "multiple_choice",
    options: [{ value: "a", labelKo: "A" }, { value: "b", labelKo: "B" }],
  });
  expectHttpError(
    () => validateSurveyAnswers([multiple], [{ questionId: multiple.id, content: { values: ["a", "a"] } }]),
    BadRequestException,
    "answer_option_invalid",
  );
});

test("requires every row of a required checkbox grid to contain a selection", () => {
  const grid = question({
    questionType: "grid_multiple",
    config: {
      rows: [{ value: "row-1", labelKo: "1행" }],
      columns: [{ value: "col-1", labelKo: "1열" }, { value: "col-2", labelKo: "2열" }],
    },
  });
  expectHttpError(
    () => validateSurveyAnswers([grid], [{ questionId: grid.id, content: { grid: { "row-1": [] } } }]),
    BadRequestException,
    "required_answer_missing",
  );
});

test("validates date and time answer formats", () => {
  expectHttpError(
    () => validateSurveyAnswers([question({ questionType: "date" })], [{ questionId: "question-1", content: { date: "2026-02-31" } }]),
    BadRequestException,
    "answer_content_invalid",
  );
  expectHttpError(
    () => validateSurveyAnswers([question({ questionType: "time" })], [{ questionId: "question-1", content: { time: "25:80" } }]),
    BadRequestException,
    "answer_content_invalid",
  );
});

test("validates configured text and checkbox response rules", () => {
  const short = question({
    id: "short",
    config: {
      validationType: "length",
      validationOperator: "min",
      validationValue: 3,
      validationErrorMessage: "세 글자 이상 입력해주세요.",
    },
  });
  assert.doesNotThrow(() =>
    validateSurveyAnswers([short], [{ questionId: "short", content: { text: "abc" } }]),
  );
  expectHttpError(
    () => validateSurveyAnswers([short], [{ questionId: "short", content: { text: "ab" } }]),
    BadRequestException,
    "세 글자 이상 입력해주세요.",
  );

  const checkbox = question({
    id: "checkbox",
    questionType: "multiple_choice",
    options: [
      { value: "a", labelKo: "A" },
      { value: "b", labelKo: "B" },
    ],
    config: {
      validationType: "checkbox_count",
      validationOperator: "max",
      validationValue: 1,
    },
  });
  expectHttpError(
    () => validateSurveyAnswers([checkbox], [{ questionId: "checkbox", content: { values: ["a", "b"] } }]),
    BadRequestException,
    "answer_validation_mismatch",
  );
});

test("honors date and time answer settings", () => {
  assert.doesNotThrow(() =>
    validateSurveyAnswers(
      [
        question({ id: "date", questionType: "date", config: { dateIncludeTime: true } }),
        question({ id: "time", questionType: "time", config: { timeAnswerType: "duration" } }),
      ],
      [
        { questionId: "date", content: { date: "2026-05-30T12:30" } },
        { questionId: "time", content: { time: "1:30" } },
      ],
    ),
  );
  expectHttpError(
    () => validateSurveyAnswers(
      [question({ questionType: "date", config: { dateIncludeYear: false } })],
      [{ questionId: "question-1", content: { date: "02-30" } }],
    ),
    BadRequestException,
    "answer_content_invalid",
  );
});

test("accepts a valid uploaded asset reference", () => {
  assert.doesNotThrow(() =>
    validateSurveyAnswers(
      [question({ questionType: "file_upload", config: { maxFiles: 1 } })],
      [{ questionId: "question-1", content: { assetId: "1" } }],
    ),
  );
});
