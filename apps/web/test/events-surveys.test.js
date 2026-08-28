const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCalendarEvents,
  buildUnifiedItems,
  filterItemsByTab,
  getCardPeriodText,
  getEventArticleState,
  sortVisibleItems,
  stripCalendarPrefix,
} = require("../dist/test-src/lib/events-surveys.js");

const NOW = Date.parse("2026-05-30T00:00:00.000Z");

function article(overrides = {}) {
  return {
    articleId: "article-1",
    boardId: 1,
    titleKo: "봄 행사",
    titleEn: "Spring Event",
    status: "PUBLISHED",
    visibilityScope: "PUBLIC",
    isPinned: false,
    pinOrder: null,
    postedAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    author: { userId: "user-1", name: "관리자" },
    isAnonymous: false,
    commentCount: 0,
    viewCount: 0,
    eventStartDate: "2026-05-29T00:00:00.000Z",
    eventEndDate: "2026-05-31T00:00:00.000Z",
    eventDescriptionKo: "행사 설명",
    eventDescriptionEn: "Event description",
    surveyId: "survey-child",
    ...overrides,
  };
}

function survey(overrides = {}) {
  return {
    id: "survey-1",
    kind: "SURVEY",
    resultVisibility: "PUBLIC",
    titleKo: "정기 설문",
    titleEn: "Regular Survey",
    descriptionKo: "설문 설명",
    descriptionEn: "Survey description",
    creatorId: "user-1",
    computedState: "open",
    publishedAt: null,
    connectedPostId: null,
    feePayersOnly: false,
    allowAnonymous: false,
    allowMultipleResponses: false,
    isKoreanOnly: false,
    isPublished: true,
    showOnCalendar: true,
    maxResponses: null,
    opensAt: "2026-05-28T00:00:00.000Z",
    closesAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-21T00:00:00.000Z",
    responseCount: 3,
    ...overrides,
  };
}

test("computes event article state from event dates", () => {
  assert.equal(getEventArticleState(article(), NOW), "open");
  assert.equal(
    getEventArticleState(
      article({ eventStartDate: "2026-06-01T00:00:00.000Z" }),
      NOW,
    ),
    "before_open",
  );
  assert.equal(
    getEventArticleState(
      article({ eventEndDate: "2026-05-29T00:00:00.000Z" }),
      NOW,
    ),
    "closed",
  );
});

test("does not treat members-only visibility as a language restriction", () => {
  const [event] = buildUnifiedItems(
    [],
    [article({ visibilityScope: "MEMBERS" })],
    NOW,
  );

  assert.equal(event.isKoreanOnly, false);
  assert.equal(event.visibilityScope, "MEMBERS");
  assert.equal(
    buildUnifiedItems([], [article({ titleEn: null })], NOW)[0].isKoreanOnly,
    true,
  );
  assert.equal(
    buildUnifiedItems(
      [],
      [article({ eventDescriptionEn: null })],
      NOW,
    )[0].isKoreanOnly,
    true,
  );
});

test("builds unified survey and event items", () => {
  const items = buildUnifiedItems(
    [survey({ allowAnonymous: true })],
    [article()],
    NOW,
  );

  assert.deepEqual(
    items.map((item) => [item.id, item.kind, item.computedState]),
    [
      ["survey-1", "SURVEY", "open"],
      ["article-1", "EVENT", "open"],
    ],
  );
  assert.equal(items[0].allowAnonymous, true);
  assert.equal(items[1].surveyId, "survey-child");
  assert.equal(items[1].descriptionKo, "행사 설명");
  assert.equal(items[1].descriptionEn, "Event description");
});

test("keeps event-connected surveys out of the pure survey tab", () => {
  const items = buildUnifiedItems(
    [
      survey({
        id: "event-child",
        kind: "APPLICATION",
        connectedPostId: "article-1",
      }),
      survey({ id: "pure-survey", kind: "SURVEY" }),
    ],
    [article({ articleId: "article-1", surveyId: "event-child" })],
    NOW,
  );

  assert.deepEqual(
    filterItemsByTab(items, "survey").map((item) => item.id),
    ["pure-survey"],
  );
  assert.deepEqual(
    filterItemsByTab(items, "event").map((item) => item.id),
    ["article-1"],
  );
});

test("renders always-open survey cards as ongoing without dates", () => {
  const [item] = buildUnifiedItems(
    [
      survey({
        id: "always-open",
        isAlwaysOpen: true,
        opensAt: null,
        closesAt: null,
      }),
    ],
    [],
    NOW,
  );

  assert.equal(item.computedState, "open");
  assert.equal(getCardPeriodText(item, "ko"), "상시");
  assert.equal(getCardPeriodText(item, "en"), "Always open");
});

test("formats event card dates as all-day or timed ranges", () => {
  const [allDayEvent] = buildUnifiedItems(
    [],
    [
      article({
        eventStartDate: "2026-07-27T00:00:00+09:00",
        eventEndDate: "2026-07-31T00:00:00+09:00",
      }),
    ],
    NOW,
  );
  const [timedEvent] = buildUnifiedItems(
    [],
    [
      article({
        eventStartDate: "2026-07-27T16:00:00+09:00",
        eventEndDate: "2026-07-31T18:00:00+09:00",
      }),
    ],
    NOW,
  );

  assert.match(getCardPeriodText(allDayEvent, "ko"), /07\.27 \(월\).*07\.31 \(금\).*종일/);
  assert.equal(
    getCardPeriodText(timedEvent, "ko"),
    "07.27 (월) 16:00 ～ 07.31 (금) 18:00",
  );
});

test("filters by tab and sorts open items before closed items", () => {
  const items = buildUnifiedItems(
    [
      survey({ id: "closed-survey", computedState: "closed" }),
      survey({ id: "open-application", kind: "APPLICATION", closesAt: "2026-05-30T12:00:00.000Z" }),
    ],
    [article({ articleId: "event-1" })],
    NOW,
  );

  assert.deepEqual(
    filterItemsByTab(items, "survey").map((item) => item.id),
    ["closed-survey", "open-application"],
  );
  assert.deepEqual(
    sortVisibleItems(filterItemsByTab(items, "survey"), "deadline", false).map(
      (item) => item.id,
    ),
    ["open-application", "closed-survey"],
  );
  assert.deepEqual(
    sortVisibleItems(items, "latest", true).map((item) => item.id),
    ["event-1", "open-application"],
  );
});

test("builds localized calendar events and strips labels", () => {
  const [openEvent, closeEvent] = buildCalendarEvents([survey()], "ko");

  assert.equal(openEvent.title, "[시작] 정기 설문");
  assert.equal(closeEvent.title, "[마감] 정기 설문");
  assert.equal(openEvent.dateType, "open");
  assert.equal(closeEvent.dateType, "close");
  assert.equal(stripCalendarPrefix(closeEvent.title), "정기 설문");
});
