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
    survey("always", { isAlwaysOpen: true, openAt: null, closeAt: null }),
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
  assert.deepEqual(first.stateCounts, { all: 15, active: 14, open: 13, before_open: 1, closed: 1 });
  assert.deepEqual(first.items.slice(0, 2).map(item => item.titleKo), [`${prefix}-0`, `${prefix}-1`]);
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
  assert.deepEqual(result.stateCounts, { all: 12, active: 12, open: 12, before_open: 0, closed: 0 });
  assert.equal((await events(1, { from: "2100-01-02", to: "2100-01-01" })).total, 0);
});

test("survey pages filter linked, hidden and draft surveys and preserve state counts", opts, async () => {
  const first = await surveyPage(1), second = await surveyPage(2);
  assert.equal(first.items.length, 9);
  assert.equal(second.items.length, 7);
  assert.equal(first.total, 16);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 16);
  assert.deepEqual(first.stateCounts, { all: 16, active: 13, open: 12, before_open: 1, closed: 1, always: 2 });
  const closed = await surveyPage(1, { state: "closed" });
  assert.equal(closed.total, 1);
  assert.deepEqual(closed.stateCounts, first.stateCounts);
  const always = await surveyPage(1, { state: "always" });
  assert.equal(always.total, 2);
  assert.ok(always.items.every(item => item.isAlwaysOpen));
  const active = await surveyPage(1, { state: "active" });
  assert.equal(active.total, 13);
  assert.ok(active.items.every(item => !item.isAlwaysOpen));
  assert.equal((await surveyPage(1, { from: "2100-01-01" })).total, 0);
});

test("public list query rejects invalid dates and states", () => {
  assert.throws(() => parsePublicListFilters({ state: "invalid" }), /invalid_public_list_filters/);
  assert.throws(() => parsePublicListFilters({ from: "2026-02-30" }), /invalid_public_list_filters/);
  assert.deepEqual(parsePublicListFilters({ state: "open", from: "2026-10-25" }), { state: "open", from: "2026-10-25" });
  assert.deepEqual(parsePublicListFilters({ state: "active" }), { state: "active" });
  assert.deepEqual(parsePublicListFilters({ state: "always" }), { state: "always" });
  assert.deepEqual(parsePublicListFilters({ eventOrder: "date" }), { eventOrder: "date" });
  assert.throws(() => parsePublicListFilters({ eventOrder: "invalid" }), /invalid_public_list_filters/);
});

test("event timeline orders the full result by event date before pagination without changing default priority", opts, async () => {
  const names = ["early", "late", "same-day", "long", "undated", "end-only", "past", "recent-past"];
  const starts = [24, 72, 25, 48, null, null, -72, -24];
  const created = await db.insert(schema.articles).values(names.map((name, i) => ({
    boardId, authorUserId: userId, titleKo: `${prefix}-timeline-${name}`, contentKo: "합성 행사",
    eventStartDate: starts[i] == null ? null : new Date(now + starts[i] * hour),
    eventEndDate: i === 4 ? null : new Date(now + (i === 5 ? 6 : starts[i] + 2) * hour),
  }))).returning();
  await db.insert(schema.surveys).values([0, 1].map(i => ({
    creatorId: userId, kind: "APPLICATION", titleKo: `${prefix}-timeline-registration-${i}`,
    connectedArticleId: created[i].articleId, lifecycleStatus: "PUBLISHED", isPublished: true,
    openAt: new Date(now - hour), closeAt: new Date(now + (i === 0 ? 12 : 1) * hour),
  })));
  const page = (n, filters) => articles.listByBoardId(boardId, n, 2, ["PUBLIC"], `${prefix}-timeline-`, undefined, false, "title", filters);
  const pages = await Promise.all([1, 2, 3, 4].map(n => page(n, { eventOrder: "date" })));
  const rows = pages.flatMap(result => result.items);
  assert.equal(pages[0].total, 8);
  assert.equal(new Set(rows.map(row => row.articleId)).size, 8);
  assert.deepEqual(rows.map(row => row.titleKo), ["past", "recent-past", "early", "same-day", "long", "late", "end-only", "undated"].map(name => `${prefix}-timeline-${name}`));
  assert.equal((await page(1, { state: "active" })).items[0].titleKo, `${prefix}-timeline-late`);
  assert.equal((await page(1, { state: "active", eventOrder: "date" })).items[0].titleKo, `${prefix}-timeline-early`);
  assert.deepEqual((await page(1, { state: "closed", eventOrder: "date" })).items.map(row => row.titleKo), ["recent-past", "past"].map(name => `${prefix}-timeline-${name}`));
});

test("active events sort by registration deadline across pages and retain closed registration", opts, async () => {
  const names = ["soon", "later", "walk-in", "always", "stopped", "past"];
  const starts = [168, 72, 24, 48, 48, -48];
  const created = await db.insert(schema.articles).values(names.map((name,i) => ({
    boardId,authorUserId:userId,titleKo:`${prefix}-deadline-event-${name}`,contentKo:"합성 행사",
    eventStartDate:new Date(now+starts[i]*hour),eventEndDate:new Date(now+(starts[i]+2)*hour),
  }))).returning();
  await db.insert(schema.surveys).values([0,1,3,4,5].map(i => ({
    creatorId:userId,kind:"APPLICATION",titleKo:`${prefix}-registration-${names[i]}`,
    connectedArticleId:created[i].articleId,lifecycleStatus:"PUBLISHED",isPublished:true,
    acceptingResponses:i!==4,isAlwaysOpen:i===3,
    openAt:new Date(now-72*hour),closeAt:i===3?null:new Date(now+(i===0?1:i===1?3:-1)*hour),
  })));
  const page = n => articles.listByBoardId(boardId,n,2,["PUBLIC"],`${prefix}-deadline-event`,undefined,false,"title",{state:"active"});
  const first=await page(1),second=await page(2),third=await page(3);
  assert.equal(first.total,5);
  assert.equal(first.stateCounts.active,5);
  assert.equal(first.stateCounts.closed,1);
  assert.deepEqual([...first.items,...second.items,...third.items].map(row=>row.titleKo),names.slice(0,5).map(name=>`${prefix}-deadline-event-${name}`));
  assert.equal(third.items[0].survey.computedState,"closed");
});

test("survey deadlines are sorted before pagination with always-open forms last", opts, async () => {
  const names=["later","soon","always","closed","upcoming"];
  await db.insert(schema.surveys).values(names.map((name,i)=>({
    creatorId:userId,kind:"SURVEY",titleKo:`${prefix}-deadline-survey-${name}`,lifecycleStatus:"PUBLISHED",isPublished:true,
    isAlwaysOpen:i===2,openAt:new Date(now+(i===4?1:-2)*hour),closeAt:i===2?null:new Date(now+[8,2,0,-1,5][i]*hour),
  })));
  const page=n=>surveys.findPublished({page:n,pageSize:2,query:`${prefix}-deadline-survey`,publicList:true,state:"active"});
  const first=await page(1),second=await page(2);
  assert.equal(first.total,3);
  assert.deepEqual([...first.items,...second.items].map(row=>row.titleKo),["soon","upcoming","later"].map(name=>`${prefix}-deadline-survey-${name}`));
});
