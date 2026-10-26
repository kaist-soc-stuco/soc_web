const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, test } = require("node:test");
const { eq, inArray } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { CalendarService } = require(base + "features/calendar/calendar.service.js");
const { CalendarSyncService } = require(base + "features/calendar/calendar-sync.service.js");
const { ArticleRepository } = require(base + "features/board/repositories/article.repository.js");
const url = process.env.OPERATIONS_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("OPERATIONS_TEST_DATABASE_URL_is_required_in_CI");
const opts = { skip: !url };
const actor = randomUUID();
const config = { get: (_key, fallback) => fallback };
const from = new Date("2026-10-01T00:00:00Z"), to = new Date("2026-11-01T00:00:00Z");
let pool, db, calendar, boardId, publicId, secretId;
before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url, max: 6 }); db = drizzle(pool, { schema });
  await db.insert(schema.users).values({ userId: actor, kaistUid: actor.slice(0, 20), nameKo: "합성 일정 관리자", email: `${actor}@example.test` });
  [{ boardId }] = await db.insert(schema.boards).values({ code: "_EVENT", nameKo: "합성 행사", allowGuestRead: true, allowSecret: true }).returning();
  const rows = await db.insert(schema.articles).values([false, true].map(isSecret => ({ boardId, authorUserId: actor, titleKo: isSecret ? "합성 비밀 행사" : "합성 공개 행사", contentKo: "합성 본문", eventDescriptionKo: "합성 설명", eventLocation: "합성 장소", visibilityScope: "PUBLIC", isSecret, eventStartDate: new Date("2026-10-26T06:00:00Z"), eventEndDate: new Date("2026-10-26T07:00:00Z") }))).returning();
  publicId = String(rows[0].articleId); secretId = String(rows[1].articleId);
  calendar = new CalendarService(db, config, { enqueueEvent: async () => {} });
});
after(async () => {
  if (!db) return;
  try {
    const ids = db.select({ id: schema.calendarEvents.calendarEventId }).from(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor));
    await db.delete(schema.calendarSyncJobs).where(inArray(schema.calendarSyncJobs.calendarEventId, ids));
    await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor));
    await db.delete(schema.boards).where(eq(schema.boards.boardId, boardId));
    await db.delete(schema.users).where(eq(schema.users.userId, actor));
  } finally { await pool.end(); }
});
const ics = (...uids) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...uids.flatMap(uid => ["BEGIN:VEVENT", `UID:${uid}`, "SUMMARY:Synthetic import", "DTSTART:20261026T060000Z", "DTEND:20261026T070000Z", "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

test("public calendar list, search and ICS do not reveal a secret event that article access denies", opts, async () => {
  assert.equal(await new ArticleRepository(db).isReadableArticle(boardId, secretId, ["PUBLIC"]), false);
  const listed = await calendar.listPublicCalendarEvents(from, to);
  const searched = await calendar.searchPublicCalendarEvents("합성", 100);
  for (const response of [listed, searched]) {
    assert.ok(response.items.some(row => row.articleId === publicId));
    assert.equal(response.items.some(row => row.articleId === secretId), false);
  }
  const feed = await calendar.exportPublicIcs();
  assert.match(feed, /합성 공개 행사/); assert.doesNotMatch(feed, /합성 비밀 행사/);
});

test("a board that disables guest reading is excluded from public calendar outputs", opts, async () => {
  await db.update(schema.boards).set({ allowGuestRead: false }).where(eq(schema.boards.boardId, boardId));
  try {
    for (const response of [await calendar.listPublicCalendarEvents(from, to), await calendar.searchPublicCalendarEvents("합성", 100)]) {
      assert.equal(response.items.some(row => row.sourceType === "ARTICLE"), false);
    }
    assert.doesNotMatch(await calendar.exportPublicIcs(), /합성 공개 행사/);
  } finally { await db.update(schema.boards).set({ allowGuestRead: true }).where(eq(schema.boards.boardId, boardId)); }
});

test("Google article synchronization publishes only guest-readable events and removes stale private copies", opts, async () => {
  const upserts = [], removed = [];
  const client = {
    upsertEvent: async input => { upserts.push(input); },
    listEvents: async () => [{ id: "previous-secret-copy", extendedProperties: { private: { socSourceType: "ARTICLE", socSourceUid: `article:${secretId}` } } }],
    deleteEvent: async input => { removed.push(input.eventId); },
  };
  const sync = new CalendarSyncService(db, config, {}, client);
  await sync.syncCouncilArticleEvents("synthetic-calendar");
  assert.deepEqual(upserts.map(item => item.resource.summary), ["합성 공개 행사"]);
  assert.deepEqual(removed, ["previous-secret-copy"]);
  await db.update(schema.boards).set({ allowGuestRead: false }).where(eq(schema.boards.boardId, boardId));
  try {
    upserts.length = 0;
    await sync.syncCouncilArticleEvents("synthetic-calendar");
    assert.equal(upserts.length, 0);
  } finally { await db.update(schema.boards).set({ allowGuestRead: true }).where(eq(schema.boards.boardId, boardId)); }
});

test("duplicate UIDs in one ICS import are skipped without rejecting unrelated events", opts, async () => {
  const repeated = randomUUID(), distinct = randomUUID();
  const result = await calendar.importIcs(actor, ics(repeated, repeated, distinct));
  assert.equal(result.importedCount, 2); assert.equal(result.skippedCount, 1);
  assert.equal((await calendar.importIcs(actor, ics(repeated, distinct))).importedCount, 0);
});

test("concurrent imports of the same ICS have one insert and one skip instead of a server error", opts, async () => {
  const uid = randomUUID();
  const results = await Promise.all([calendar.importIcs(actor, ics(uid)), calendar.importIcs(actor, ics(uid))]);
  assert.deepEqual(results.map(result => result.importedCount).sort(), [0, 1]);
});

test("ICS identity is scoped to the source type just like its database unique key", opts, async () => {
  const uid = randomUUID();
  await db.insert(schema.calendarEvents).values({ sourceUid: uid, sourceType: "KAIST_ACADEMIC", titleKo: "합성 학사 일정", startAt: from, endAt: to, createdByUserId: actor });
  const result = await calendar.importIcs(actor, ics(uid));
  assert.equal(result.importedCount, 1); assert.equal(result.items[0].sourceType, "MANUAL");
});
