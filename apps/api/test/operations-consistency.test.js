const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, beforeEach, after, test } = require("node:test");
const { eq, inArray, like } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require(base + "features/users/repositories/users.repository.js");
const { SurveysService } = require(base + "features/surveys/surveys.service.js");
const { SurveyResponsesRepository } = require(base + "features/surveys/survey-responses.repository.js");
const { RoleGroupsRepository } = require(base + "features/role-groups/role-groups.repository.js");
const { VotesRepository } = require(base + "features/votes/votes.repository.js");
const { ContactsRepository } = require(base + "features/contacts/contacts.repository.js");
const { ContactsService } = require(base + "features/contacts/contacts.service.js");
const { CalendarService } = require(base + "features/calendar/calendar.service.js");
const { SiteContentRepository } = require(base + "features/site-content/site-content.repository.js");
const { SiteContentService } = require(base + "features/site-content/site-content.service.js");
const url = process.env.OPERATIONS_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("OPERATIONS_TEST_DATABASE_URL_is_required_in_CI");
const opts = { skip: !url };
const actor = randomUUID();
const prefix = `ops-${actor.slice(0, 8)}`;
const audit = { record: async () => {} };
const config = { get: (_key, fallback) => fallback };
const fixtureUsers = [];
let pool, db, users, contacts;

before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url, max: 8 });
  db = drizzle(pool, { schema });
  users = new UsersRepository(db, { get: async () => null }, config);
  contacts = new ContactsRepository(db);
  await db.insert(schema.users).values({ userId: actor, kaistUid: actor.slice(0, 20), nameKo: "합성 운영 관리자", email: `${actor}@example.test`, isActive: true });
});
beforeEach(async () => {
  if (!db) return;
  await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.createdBy, actor));
});
after(async () => {
  if (!db) return;
  try {
    await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.createdBy, actor));
    await db.delete(schema.executiveContacts).where(like(schema.executiveContacts.nameKo, `${prefix}%`));
    const ids = [actor, ...fixtureUsers];
    await db.delete(schema.votes).where(eq(schema.votes.creatorId, actor));
    await db.delete(schema.studentFeePayments).where(inArray(schema.studentFeePayments.userId, ids));
    await db.delete(schema.studentFeeStatus).where(inArray(schema.studentFeeStatus.userId, ids));
    await db.delete(schema.calendarSyncJobs).where(inArray(schema.calendarSyncJobs.calendarEventId,
      db.select({ id: schema.calendarEvents.calendarEventId }).from(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor))));
    await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor));
    await db.delete(schema.users).where(inArray(schema.users.userId, ids));
  } finally { await pool.end(); }
});

async function feeUser(name, { status = "UNPAID", paidAt = null, paidAmount = 0, coverageSemesters = 1, payments = [] }) {
  const userId = randomUUID();
  fixtureUsers.push(userId);
  await db.insert(schema.users).values({ userId, kaistUid: userId.slice(0, 20), nameKo: `${prefix}-${name}`, email: `${userId}@example.test`, primaryMajor: "School of Computing", isActive: true });
  await db.insert(schema.studentFeeStatus).values({ userId, status, paidAt, paidAmount, coverageSemesters });
  if (payments.length) await db.insert(schema.studentFeePayments).values(payments.map(payment => ({ userId, amount: 45000, paymentType: "FULL", paymentMethod: "BANK_TRANSFER", paidAt: new Date(), ...payment })));
  return userId;
}

test("financial status agrees across filters, mail and surveys without a separate semester consent", opts, async () => {
  const ref = users.currentReferenceSemester();
  const year = Number(ref.slice(0, 4)), half = Number(ref.at(-1));
  const currentDate = new Date(Date.UTC(year, half === 1 ? 1 : 7, 10));
  const oldDate = new Date(Date.UTC(year - 4, 1, 10));
  const next = half === 1 ? `${year}-2` : `${year + 1}-1`;
  const cases = [
    ["expired", { status: "PAID", paidAt: oldDate, paidAmount: 45000 }, "PAID"],
    ["current", { status: "PAID", paidAt: currentDate, paidAmount: 45000 }, "PAID"],
    ["legacy", { status: "PAID", paidAt: null, paidAmount: 45000 }, "PAID"],
    ["ledger", { status: "UNPAID", payments: [{ effectiveStartSemester: ref, coverageSemesters: 1 }] }, "PAID"],
    ["future", { status: "PAID", paidAt: oldDate, payments: [{ effectiveStartSemester: next, coverageSemesters: 1 }] }, "PAID"],
    ["partial", { status: "PARTIAL", paidAt: currentDate, paidAmount: 10000 }, "PARTIAL"],
    ["partial-expired", { status: "PARTIAL", paidAt: oldDate, paidAmount: 10000 }, "PARTIAL"],
    ["partial-zero", { status: "PARTIAL", paidAt: null }, "UNPAID"],
  ];
  const rows = [];
  for (const [name, input, expected] of cases) rows.push({ userId: await feeUser(name, input), expected });
  const ids = rows.map(row => row.userId);
  const feeList = await users.listStudentsByFeeStatus(undefined, 1, 100, "name", "asc", undefined, undefined, undefined, ref, ids);
  const surveys = new SurveysService({}, {}, {}, {}, {}, { findById: id => users.findById(id), getStudentFeeStatus: id => users.getStudentFeeStatus(id) });
  const paidMail = await users.listEmailRecipients("PAID_STUDENTS", { query: prefix });
  const unpaidMail = await users.listEmailRecipients("UNPAID_STUDENTS", { query: prefix });
  for (const { userId, expected } of rows) {
    assert.equal((await users.getStudentFeeStatus(userId)).status, expected);
    assert.equal(feeList.students.find(row => row.userId === userId).status, expected);
    const caller = { id: userId, permission: 0 };
    const eligibility = surveys.getParticipationEligibility({ feePayersOnly: true }, caller, await surveys.loadEligibilityContext(caller));
    assert.equal(eligibility.status, expected === "PAID" ? "ELIGIBLE" : "NOT_ELIGIBLE");
    assert.equal(await db.transaction(tx => new SurveyResponsesRepository(db).feeRequirementFailure(tx, userId, "PAID_ONLY")), expected === "PAID" ? null : "fee_payer_only");
    assert.equal(paidMail.some(row => row.email === `${userId}@example.test`), expected === "PAID");
    assert.equal(unpaidMail.some(row => row.email === `${userId}@example.test`), expected === "UNPAID");
  }
  for (const status of ["PAID", "PARTIAL", "UNPAID"]) {
    const members = await users.listAdminUsers({ query: prefix, feeStatus: status, pageSize: 100 });
    assert.deepEqual(new Set(members.items.map(row => row.userId)), new Set(rows.filter(row => row.expected === status).map(row => row.userId)));
    assert.ok(members.items.every(row => row.feeStatus === status));
    assert.equal(members.total, rows.filter(row => row.expected === status).length);
    assert.equal(members.facets.paid, 5);
    assert.equal(members.facets.partial, 2);
    const candidates = await new RoleGroupsRepository(db).listRoleGroupCandidates(0, { q: prefix, feeStatus: status, pageSize: 100 });
    assert.deepEqual(new Set(candidates.items.map(row => row.userId)), new Set(rows.filter(row => row.expected === status).map(row => row.userId)));
  }
  const [vote] = await db.insert(schema.votes).values({ creatorId: actor, titleKo: "합성 선거", status: "DRAFT", startsAt: new Date(), endsAt: new Date(Date.now() + 3600_000) }).returning();
  const voterRepo = new VotesRepository(db);
  await voterRepo.addVoters(vote.voteId, ids);
  const voters = await voterRepo.listVoters(vote.voteId);
  for (const row of rows) assert.equal(voters.find(voter => voter.userId === row.userId).feeStatus, row.expected);
});

test("historical fee completion no longer expires when viewing a later semester", opts, async () => {
  const year = Number(users.currentReferenceSemester().slice(0, 4)) - 4;
  const id = await feeUser("history", { status: "PAID", paidAt: new Date(Date.UTC(year, 2, 1)), paidAmount: 45000 });
  assert.equal((await users.getStudentFeeStatus(id)).status, "PAID");
  assert.equal((await users.getStudentFeeDetail(id, `${year}-1`)).status.status, "PAID");
  assert.equal((await users.getStudentFeeDetail(id)).status.status, "PAID");
});

test("revoking consent deletes the contact without creating an external Sheets job", opts, async () => {
  const created = await contacts.insert({ nameKo: `${prefix}-revoke`, nameEn: "Synthetic", roleKo: "검증", roleEn: "Synthetic" });
  let separateQueueCalls = 0;
  const service = new ContactsService(contacts, audit, {}, { enqueueSync: async () => { separateQueueCalls++; } });
  const saved = await service.update(created.id, { privacyConsented: false });
  assert.equal(saved.id, created.id);
  assert.equal(saved.privacyConsented, false);
  assert.equal(await contacts.findById(created.id), null);
  const [job] = await db.select().from(schema.googleSpreadsheetSyncJobs).where(eq(schema.googleSpreadsheetSyncJobs.resourceType, "CONTACTS"));
  assert.equal(job, undefined);
  assert.equal(separateQueueCalls, 0);
  await assert.rejects(service.update(randomUUID(), { privacyConsented: false }), error => error.getStatus() === 404);
});

test("retired Sheets inserts cannot block a consent deletion", opts, async () => {
  const created = await contacts.insert({ nameKo: `${prefix}-rollback`, nameEn: "Synthetic", roleKo: "검증", roleEn: "Synthetic" });
  const failing = new ContactsRepository({ transaction: callback => db.transaction(tx => callback(new Proxy(tx, {
    get(target, key) {
      if (key === "insert") return () => { throw new Error("injected_queue_failure"); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }))) });
  await failing.update(created.id, { privacyConsented: false });
  assert.equal(await contacts.findById(created.id), null);
});

test("contact export traverses all pages with filters and audits the full exported count", opts, async () => {
  await db.insert(schema.executiveContacts).values(Array.from({ length: 1001 }, (_, index) => ({ nameKo: `${prefix}-export-${index}`, nameEn: "Synthetic", roleKo: "검증", roleEn: "Synthetic" })));
  const entries = [];
  const service = new ContactsService(contacts, { record: async entry => entries.push(entry) }, {}, { enqueueSync: async () => {} });
  const items = await service.exportManaged({ q: `${prefix}-export-` }, undefined, "synthetic verification");
  assert.equal(items.length, 1001);
  assert.equal(new Set(items.map(row => row.id)).size, 1001);
  assert.equal(entries.find(row => row.action === "executive_contact.export").payload.count, 1001);
});

const calendar = () => new CalendarService(db, config, { enqueueEvent: async () => {} }, audit);
const ics = events => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.flatMap(event => ["BEGIN:VEVENT", `UID:${randomUUID()}`, "SUMMARY:Synthetic calendar", ...event, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

test("ICS imports preserve Seoul, UTC, floating and other IANA time zones", opts, async () => {
  const result = await calendar().importIcs(actor, ics([
    ["DTSTART;TZID=Asia/Seoul:20261026T150000", "DTEND;TZID=Asia/Seoul:20261026T160000"],
    ["DTSTART:20261026T060000Z", "DTEND:20261026T070000Z"],
    ["DTSTART:20261026T150000", "DTEND:20261026T160000"],
    ["DTSTART;TZID=America/New_York:20260701T090000", "DTEND;TZID=America/New_York:20260701T100000"],
  ]));
  assert.deepEqual(result.items.map(row => row.startAt), ["2026-10-26T06:00:00.000Z", "2026-10-26T06:00:00.000Z", "2026-10-26T06:00:00.000Z", "2026-07-01T13:00:00.000Z"]);
  assert.ok(result.items.every(row => row.isAllDay === false));
});

test("all-day ICS retains the date range, exclusive end and export round trip", opts, async () => {
  const service = calendar();
  const result = await service.importIcs(actor, ics([["DTSTART;VALUE=DATE:20261026", "DTEND;VALUE=DATE:20261028"]]));
  assert.equal(result.items[0].isAllDay, true);
  assert.equal(result.items[0].startAt, "2026-10-25T15:00:00.000Z");
  assert.equal(result.items[0].endAt, "2026-10-27T14:59:59.999Z");
  const exported = await service.exportIcs();
  assert.ok(exported.includes("DTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261028"));
});

test("invalid ICS time zones fail before persisting any events", opts, async () => {
  const beforeRows = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor));
  await assert.rejects(calendar().importIcs(actor, ics([["DTSTART;TZID=Invalid/Zone:20261026T150000", "DTEND;TZID=Invalid/Zone:20261026T160000"]])), error => error.getStatus() === 400);
  const afterRows = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.createdByUserId, actor));
  assert.equal(afterRows.length, beforeRows.length);
});

function contentService() {
  const repo = new SiteContentRepository(db);
  const read = repo.listContentBlocks.bind(repo);
  let arrivals = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  repo.listContentBlocks = async () => { const rows = await read(); if (++arrivals === 2) release(); await gate; return rows; };
  return new SiteContentService(repo, audit);
}
test("concurrent singleton creation returns one success and one 409", opts, async () => {
  for (const type of ["HERO", "LOGO", "TOP_BANNER", "ORGANIZATION_CHART"]) {
    const service = contentService();
    const results = await Promise.allSettled([1, 2].map(index => service.createContentBlock({ type, titleKo: `검증 ${index}`, imageUrl: "https://example.invalid/image.png" }, { actorUserId: actor })));
    assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
    assert.equal(results.find(row => row.status === "rejected").reason.getStatus(), 409);
  }
});

test("singleton conversion races are rejected while ordinary content can be repeated", opts, async () => {
  const repo = new SiteContentRepository(db);
  const links = await Promise.all([1, 2].map(index => repo.createContentBlock({ type: "QUICK_LINK", titleKo: `검증 ${index}` }, actor)));
  const service = contentService();
  const results = await Promise.allSettled(links.map(link => service.updateContentBlock(link.contentBlockId, { type: "TOP_BANNER" }, { actorUserId: actor })));
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(results.find(row => row.status === "rejected").reason.getStatus(), 409);
});
