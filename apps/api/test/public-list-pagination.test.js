const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, test } = require("node:test");
const { eq } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { ArticleRepository } = require(base + "features/board/repositories/article.repository.js");
const { SurveysRepository } = require(base + "features/surveys/surveys.repository.js");
const { parsePublicListFilters } = require(base + "shared/public-list.js");
const url = process.env.PUBLIC_LIST_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("PUBLIC_LIST_TEST_DATABASE_URL_is_required_in_CI");
const opts = { skip: !url };
const userId = randomUUID();
const prefix = `public-list-${userId}`;
const now = Date.now();
const hour = 3_600_000;
let pool, db, articles, surveys, boardId;

before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url });
  db = drizzle(pool, { schema });
  articles = new ArticleRepository(db);
  surveys = new SurveysRepository(db);
  await db.insert(schema.users).values({ userId, kaistUid: userId.slice(0, 20), nameKo: "합성 목록 사용자", email: `${userId}@example.test` });
  [{ boardId }] = await db.insert(schema.boards).values({ code: userId.slice(0, 20), nameKo: "목록 검증" }).returning();
  const event = (index, start, end, extra = {}) => ({
    boardId, authorUserId: userId, titleKo: `${prefix}-${index}`, contentKo: "합성 행사",
    eventStartDate: start == null ? null : new Date(start),
    eventEndDate: end == null ? null : new Date(end), ...extra,
  });
  const created = await db.insert(schema.articles).values([
    ...Array.from({ length: 12 }, (_, i) => event(i, now - hour, now + (i + 1) * hour)),
    event("future", now + 72 * hour, now + 73 * hour),
    event("closed", now - 73 * hour, now - 72 * hour),
    event("no-start", null, now + hour),
    event("private", now - hour, now + hour, { visibilityScope: "MEMBERS" }),
    event("draft", now - hour, now + hour, { status: "DRAFT" }),
  ]).returning();
  const survey = (index, extra = {}) => ({
    creatorId: userId, kind: "SURVEY", titleKo: `${prefix}-${index}`,
    lifecycleStatus: "PUBLISHED", isPublished: true,
    openAt: new Date(now - hour), closeAt: new Date(now + hour), ...extra,
  });
  await db.insert(schema.surveys).values([
    ...Array.from({ length: 12 }, (_, i) => survey(i)),
    survey("future", { openAt: new Date(now + 72 * hour), closeAt: new Date(now + 73 * hour) }),
    survey("closed", { closeAt: new Date(now - hour) }),
    survey("stopped", { acceptingResponses: false, isAlwaysOpen: true }),
    survey("linked", { connectedArticleId: created[0].articleId }),
    survey("hidden", { showOnList: false }),
    survey("draft", { lifecycleStatus: "DRAFT", isPublished: false }),
  ]);
});

after(async () => {
  if (!db) return;
  try {
    await db.delete(schema.surveys).where(eq(schema.surveys.creatorId, userId));
    await db.delete(schema.boards).where(eq(schema.boards.boardId, boardId));
    await db.delete(schema.users).where(eq(schema.users.userId, userId));
  } finally { await pool.end(); }
});

const events = (page, filters = {}) => articles.listByBoardId(boardId, page, 9, ["PUBLIC"], prefix, undefined, false, "title", filters);
const surveyPage = (page, filters = {}) => surveys.findPublished({ page, pageSize: 9, query: prefix, publicList: true, ...filters });

test("event pages are bounded, disjoint, sorted and exclude private/draft rows", opts, async () => {
  const first = await events(1), second = await events(2);
  assert.equal(first.items.length, 9);
  assert.equal(second.items.length, 6);
  assert.equal(first.total, 15);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.articleId)).size, 15);
  assert.deepEqual(first.stateCounts, { all: 15, open: 13, before_open: 1, closed: 1 });
  assert.deepEqual(first.items.slice(0, 2).map(item => item.titleKo), [`${prefix}-no-start`, `${prefix}-0`]);
  const selected = await events(1, { state: "before_open" });
  assert.equal(selected.total, 1);
  assert.equal(selected.items[0].titleKo, `${prefix}-future`);
  assert.deepEqual(selected.stateCounts, first.stateCounts);
});

test("event date filters use Korean day boundaries and interval overlap before pagination", opts, async () => {
  const day = new Date(now + 9 * hour).toISOString().slice(0, 10);
  const result = await events(1, { from: day, to: day });
  assert.equal(result.total, 12);
  assert.equal(result.items.length, 9);
  assert.deepEqual(result.stateCounts, { all: 12, open: 12, before_open: 0, closed: 0 });
  assert.equal((await events(1, { from: "2100-01-02", to: "2100-01-01" })).total, 0);
});

test("survey pages filter linked, hidden and draft surveys and preserve state counts", opts, async () => {
  const first = await surveyPage(1), second = await surveyPage(2);
  assert.equal(first.items.length, 9);
  assert.equal(second.items.length, 6);
  assert.equal(first.total, 15);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 15);
  assert.deepEqual(first.stateCounts, { all: 15, open: 12, before_open: 1, closed: 2 });
  const closed = await surveyPage(1, { state: "closed" });
  assert.equal(closed.total, 2);
  assert.deepEqual(closed.stateCounts, first.stateCounts);
  assert.equal((await surveyPage(1, { from: "2100-01-01" })).total, 0);
});

test("public list query rejects invalid dates and states", () => {
  assert.throws(() => parsePublicListFilters({ state: "invalid" }), /invalid_public_list_filters/);
  assert.throws(() => parsePublicListFilters({ from: "2026-02-30" }), /invalid_public_list_filters/);
  assert.deepEqual(parsePublicListFilters({ state: "open", from: "2026-10-25" }), { state: "open", from: "2026-10-25" });
});
