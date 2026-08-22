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
