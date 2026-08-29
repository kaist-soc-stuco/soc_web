const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SurveysService,
} = require("../dist/apps/api/src/features/surveys/surveys.service.js");

const NOW = "2026-08-29T00:00:00.000Z";

function makeSurvey(overrides = {}) {
  return {
    id: "survey-1",
    kind: "SURVEY",
    resultVisibility: "PRIVATE",
    titleKo: "진로 설문",
    titleEn: "Career survey",
    descriptionKo: null,
    descriptionEn: null,
    descriptionImageUrlKo: null,
    descriptionImageUrlEn: null,
    creatorId: "creator-1",
    publishedAt: null,
    connectedPostId: null,
    feePayersOnly: false,
    eligibleSocAffiliations: [],
    academicEligibility: "ANY",
    allowAnonymous: false,
    allowMultipleResponses: false,
    allowResponseEdit: false,
    isKoreanOnly: false,
    isPublished: false,
    lifecycleStatus: "DRAFT",
    previousVersionId: null,
    versionNumber: 1,
    derivedVersionCount: 0,
    showOnCalendar: false,
    maxResponses: null,
    isAlwaysOpen: true,
    opensAt: null,
    closesAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    responseCount: 0,
    spreadsheetId: null,
    spreadsheetUrl: null,
    spreadsheetSyncStatus: "NOT_CONNECTED",
    spreadsheetLastSyncedAt: null,
    ...overrides,
  };
}

function createHarness({ connect } = {}) {
  let current = makeSurvey();
  const calls = [];
  const surveyRepository = {
    findById: async (_id, tx) => {
      calls.push({ kind: "findById", tx });
      return current;
    },
    findByConnectedArticleId: async () => null,
    update: async (_id, dto) => {
      current = makeSurvey({
        ...current,
        isPublished: dto.isPublished ?? current.isPublished,
        lifecycleStatus: dto.isPublished ? "PUBLISHED" : current.lifecycleStatus,
      });
      return current;
    },
  };
  const sectionsRepository = {
    findBySurveyId: async () => [{
      id: "section-1",
      titleKo: "기본 정보",
      titleEn: "Basic information",
      sortOrder: 0,
      questions: [],
    }],
  };
  const questionsRepository = {
    findBySectionId: async () => [{
      id: "question-1",
      titleKo: "이름",
      titleEn: "Name",
      questionType: "short_text",
      options: null,
      config: null,
      answerRegex: null,
      isRequired: true,
      sortOrder: 0,
    }],
  };
  const responsesRepository = { countSubmitted: async () => 0 };
  const policy = {
    withSurveyLock: async (_id, callback) => callback({ transaction: true }),
  };
  const sheets = {
    connect: connect ?? (async () => {
      calls.push({ kind: "connect" });
      return makeSurvey({
        ...current,
        spreadsheetId: "sheet-1",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-1/edit",
        spreadsheetSyncStatus: "CONNECTED",
        spreadsheetLastSyncedAt: NOW,
      });
    }),
  };

  return {
    calls,
    repository: surveyRepository,
    service: new SurveysService(
      surveyRepository,
      sectionsRepository,
      questionsRepository,
      responsesRepository,
      policy,
      undefined,
      sheets,
    ),
  };
}

test("creates the response sheet on the first survey publication", async () => {
  const { service, calls } = createHarness();

  const result = await service.update("survey-1", { isPublished: true });

  assert.equal(calls.filter((call) => call.kind === "connect").length, 1);
  assert.equal(result.isPublished, true);
  assert.equal(result.spreadsheetId, "sheet-1");
  assert.equal(result.spreadsheetSyncStatus, "CONNECTED");
});

test("keeps publication successful when response sheet creation fails", async () => {
  const failedSurvey = makeSurvey({
    isPublished: true,
    lifecycleStatus: "PUBLISHED",
    spreadsheetSyncStatus: "ERROR",
  });
  const { service, repository } = createHarness({
    connect: async () => {
      throw new Error("oauth unavailable");
    },
  });
  repository.findById = async (_id, tx) =>
    tx ? makeSurvey() : failedSurvey;

  const result = await service.update("survey-1", { isPublished: true });

  assert.equal(result.isPublished, true);
  assert.equal(result.spreadsheetSyncStatus, "ERROR");
});
