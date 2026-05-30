const assert = require("node:assert/strict");
const test = require("node:test");

const {
  filterAndSortSurveys,
  getSurveyStatusInfo,
} = require("../dist/test-src/lib/survey-display.js");
const NOW = Date.parse("2026-05-30T00:00:00.000Z");

function survey(overrides = {}) {
  return {
    id: "survey-1",
    kind: "SURVEY",
    resultVisibility: "PRIVATE",
    titleKo: "정기 설문",
    titleEn: "Regular Survey",
    descriptionKo: "설명",
    descriptionEn: "Description",
    creatorId: "user-1",
    computedState: "open",
    publishedAt: "2026-05-01T00:00:00.000Z",
    connectedPostId: null,
    feePayersOnly: false,
    allowMultipleResponses: false,
    isKoreanOnly: false,
    isPublished: true,
    showOnCalendar: true,
    maxResponses: null,
    opensAt: "2026-05-01T00:00:00.000Z",
    closesAt: "2026-06-02T00:00:00.000Z",
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T12:00:00.000Z",
    responseCount: 0,
    ...overrides,
  };
}

test("returns draft status for unpublished surveys", () => {
  assert.deepEqual(
    getSurveyStatusInfo(survey({ isPublished: false }), true, NOW),
    { label: "임시저장", tone: "draft" },
  );
});

test("returns computed open status with deterministic D-day text", () => {
  assert.deepEqual(
    getSurveyStatusInfo(survey({ closesAt: "2026-06-02T00:00:00.000Z" }), true, NOW),
    { label: "진행중 · D-3", tone: "open" },
  );
});

test("falls back to open and close timestamps when computed state is absent", () => {
  assert.deepEqual(
    getSurveyStatusInfo(
      survey({
        closesAt: "2026-05-29T23:59:59.000Z",
        computedState: null,
      }),
      true,
      NOW,
    ),
    { label: "마감", tone: "closed" },
  );

  assert.deepEqual(
    getSurveyStatusInfo(
      survey({
        computedState: null,
        opensAt: "2026-05-31T00:00:00.000Z",
      }),
      true,
      NOW,
    ),
    { label: "개시 전", tone: "beforeOpen" },
  );
});

test("filters surveys by query, status, type, and period", () => {
  const surveys = [
    survey({
      id: "old-event",
      kind: "APPLICATION",
      titleKo: "행사 신청",
      createdAt: "2026-04-01T00:00:00.000Z",
      responseCount: 10,
    }),
    survey({
      id: "fresh-vote",
      kind: "VOTE",
      titleKo: "대표 선거",
      descriptionEn: "leadership vote",
      createdAt: "2026-05-28T00:00:00.000Z",
      responseCount: 5,
    }),
    survey({
      id: "draft-vote",
      kind: "VOTE",
      titleKo: "임시 선거",
      computedState: "closed",
      createdAt: "2026-05-30T00:00:00.000Z",
      isPublished: false,
      responseCount: 100,
    }),
  ];

  const result = filterAndSortSurveys(
    surveys,
    {
      periodFilter: "7days",
      searchQuery: "선거",
      sortBy: "responseCount",
      statusFilter: "open",
      typeFilter: "VOTE",
    },
    NOW,
  );

  assert.deepEqual(result.map((item) => item.id), ["fresh-vote"]);
});

test("sorts surveys by updated date and response count", () => {
  const surveys = [
    survey({
      id: "a",
      responseCount: 1,
      updatedAt: "2026-05-29T00:00:00.000Z",
    }),
    survey({
      id: "b",
      responseCount: 3,
      updatedAt: "2026-05-30T00:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    filterAndSortSurveys(
      surveys,
      {
        periodFilter: "all",
        searchQuery: "",
        sortBy: "updatedAt",
        statusFilter: "all",
        typeFilter: "all",
      },
      NOW,
    ).map((item) => item.id),
    ["b", "a"],
  );

  assert.deepEqual(
    filterAndSortSurveys(
      surveys,
      {
        periodFilter: "all",
        searchQuery: "",
        sortBy: "responseCount",
        statusFilter: "all",
        typeFilter: "all",
      },
      NOW,
    ).map((item) => item.id),
    ["b", "a"],
  );
});
