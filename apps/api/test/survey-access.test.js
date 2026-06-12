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

function createService({ answers = [], surveyRecord = survey() } = {}) {
  const sections = [{ id: "section-1" }];
  const questions = [
    {
      id: "question-1",
      questionType: "short_text",
      titleKo: "질문",
      titleEn: null,
      options: null,
    },
  ];

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

test("survey managers can read private analytics", async () => {
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
  assert.equal(analytics.questions[0].texts[0], "좋았습니다");
});
