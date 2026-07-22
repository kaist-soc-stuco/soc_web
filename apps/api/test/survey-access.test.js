const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException, NotFoundException } = require("@nestjs/common");
const { Permissions } = require("@soc/contracts");

const {
  SurveysService,
} = require("../dist/apps/api/src/features/surveys/surveys.service.js");

const manager = { id: "manager-1", permission: Permissions.MANAGE_SURVEY };
const user = { id: "user-1", permission: 0 };

function survey(overrides = {}) {
  return {
    id: "survey-1",
    kind: "SURVEY",
    titleKo: "설문",
    titleEn: null,
    descriptionKo: null,
    descriptionEn: null,
    creatorId: "creator-1",
    resultVisibility: "PRIVATE",
    feePayersOnly: false,
    allowMultipleResponses: false,
    allowResponseEdit: false,
    isKoreanOnly: false,
    isPublished: true,
    showOnCalendar: true,
    maxResponses: null,
    opensAt: null,
    closesAt: null,
    connectedPostId: null,
    isAlwaysOpen: false,
    publishedAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createService({
  answers = [],
  questions = [
    {
      id: "question-1",
      questionType: "short_text",
      titleKo: "질문",
      titleEn: null,
      options: null,
    },
  ],
  surveyRecord = survey(),
} = {}) {
  const sections = [{ id: "section-1" }];

  return new SurveysService(
    {
      findAll: async () => [surveyRecord],
      findPublished: async () =>
        surveyRecord.isPublished ? [surveyRecord] : [],
      findById: async () => surveyRecord,
    },
    { findBySurveyId: async () => sections },
    { findBySectionId: async () => questions },
    {
      countSubmitted: async () => 1,
      findAnswersBySurveyId: async () => answers,
      findByUserAndSurvey: async () => null,
    },
    {},
  );
}

async function expectHttpError(promise, ExceptionClass, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ExceptionClass);
    assert.equal(error.message, message);
    return true;
  });
}

test("unpublished surveys are hidden from regular users", async () => {
  const service = createService({
    surveyRecord: survey({ isPublished: false }),
  });

  await expectHttpError(
    service.findDetail("survey-1", user),
    NotFoundException,
    "survey_not_found",
  );
});

test("survey managers can preview unpublished surveys without publishing them", async () => {
  const service = createService({
    surveyRecord: survey({ isPublished: false }),
  });

  const detail = await service.findDetail("survey-1", manager);

  assert.equal(detail.id, "survey-1");
  assert.equal(detail.isPreview, true);
  assert.equal(detail.isPublished, false);
});

test("private survey analytics are backend-protected for regular users", async () => {
  const service = createService({
    surveyRecord: survey({ resultVisibility: "PRIVATE" }),
  });

  await expectHttpError(
    service.getAnalytics("survey-1", user),
    ForbiddenException,
    "analytics_access_forbidden",
  );
});

test("private analytics do not include raw answers even for survey managers", async () => {
  const service = createService({
    answers: [
      {
        questionId: "question-1",
        content: { text: "좋았습니다" },
      },
    ],
    surveyRecord: survey({ resultVisibility: "PRIVATE" }),
  });

  const analytics = await service.getAnalytics("survey-1", manager);

  assert.equal(analytics.surveyId, "survey-1");
  assert.equal(analytics.totalResponses, 1);
  assert.equal(analytics.questions[0].rawAnswersHidden, true);
  assert.equal("texts" in analytics.questions[0], false);
  assert.equal(JSON.stringify(analytics).includes("좋았습니다"), false);
});

test("public analytics never expose free-text, date, or time answer values", async () => {
  const sensitiveAnswers = [
    { questionId: "short", content: { text: "private-short-answer" } },
    { questionId: "long", content: { text: "private-long-answer" } },
    { questionId: "date", content: { date: "2026-07-15" } },
    { questionId: "time", content: { time: "13:37" } },
    {
      questionId: "datetime",
      content: { datetime: "2026-07-15T13:37:00.000Z" },
    },
  ];
  const questions = [
    { id: "short", questionType: "short_text", titleKo: "단답", titleEn: null, options: null },
    { id: "long", questionType: "long_text", titleKo: "장문", titleEn: null, options: null },
    { id: "date", questionType: "date", titleKo: "날짜", titleEn: null, options: null },
    { id: "time", questionType: "time", titleKo: "시간", titleEn: null, options: null },
    { id: "datetime", questionType: "datetime", titleKo: "일시", titleEn: null, options: null },
  ];
  const service = createService({
    answers: sensitiveAnswers,
    questions,
    surveyRecord: survey({ resultVisibility: "PUBLIC" }),
  });

  const analytics = await service.getAnalytics("survey-1", user);
  const serialized = JSON.stringify(analytics);

  assert.equal(analytics.questions.length, 5);
  for (const question of analytics.questions) {
    assert.equal(question.totalAnswers, 1);
    assert.equal(question.rawAnswersHidden, true);
    assert.equal("texts" in question, false);
  }
  for (const answer of sensitiveAnswers) {
    for (const value of Object.values(answer.content)) {
      assert.equal(serialized.includes(String(value)), false);
    }
  }
});

test("public analytics retain safe choice counts and numeric percentages", async () => {
  const service = createService({
    answers: [
      { questionId: "choice", content: { value: "a" } },
      { questionId: "choice", content: { value: "a" } },
      { questionId: "choice", content: { value: "b" } },
    ],
    questions: [
      {
        id: "choice",
        questionType: "single_choice",
        titleKo: "선택",
        titleEn: "Choice",
        options: [
          { value: "a", labelKo: "가", labelEn: "A" },
          { value: "b", labelKo: "나", labelEn: "B" },
        ],
      },
    ],
    surveyRecord: survey({ resultVisibility: "PUBLIC" }),
  });

  const analytics = await service.getAnalytics("survey-1", user);
  const [question] = analytics.questions;

  assert.equal(question.rawAnswersHidden, false);
  assert.equal(question.totalAnswers, 3);
  assert.deepEqual(
    question.choices.map(({ value, count, percentage }) => ({
      value,
      count,
      percentage,
    })),
    [
      { value: "a", count: 2, percentage: 66.7 },
      { value: "b", count: 1, percentage: 33.3 },
    ],
  );
});

test("new surveys default to private results without defaulting PATCH requests", () => {
  const { CreateSurveySchema, UpdateSurveySchema } = require("@soc/contracts");

  const created = CreateSurveySchema.parse({
    kind: "SURVEY",
    titleKo: "기본 비공개 설문",
  });
  const updated = UpdateSurveySchema.parse({ titleKo: "제목만 수정" });

  assert.equal(created.resultVisibility, "PRIVATE");
  assert.equal("resultVisibility" in updated, false);
});
