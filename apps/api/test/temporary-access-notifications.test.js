const assert = require("node:assert/strict");
const { test, before, after } = require("node:test");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Permissions } = require("@soc/contracts");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { SurveyResponsesRepository } = require(base + "features/surveys/survey-responses.repository.js");
const { SurveyResponsesService } = require(base + "features/surveys/survey-responses.service.js");
const { SurveysService } = require(base + "features/surveys/surveys.service.js");
const { UsersRepository } = require(base + "features/users/repositories/users.repository.js");
const { UsersService } = require(base + "features/users/users.service.js");
const { BulkEmailService } = require(base + "features/email/bulk-email.service.js");

const temporary = { permission: 0, temporaryClaims: { sub: "synthetic", primaryMajor: "전산학부" } };
const survey = (overrides = {}) => ({ id: "synthetic", titleKo: "합성 설문", isPublished: true, isAlwaysOpen: true, allowAnonymous: false, allowMultipleResponses: false, allowResponseEdit: false, feePayersOnly: false, ...overrides });

test("temporary visitors receive the membership notice for single-response, editing, fee and required-file surveys", async () => {
  for (const [settings, questions] of [
    [{}, []],
    [{ allowAnonymous: true, allowMultipleResponses: true, allowResponseEdit: true }, []],
    [{ allowMultipleResponses: true, feePayersOnly: true }, []],
    [{ allowAnonymous: true, allowMultipleResponses: true }, [{ id: "file", questionType: "file_upload", isRequired: true }]],
  ]) {
    const record = survey(settings);
    const service = new SurveysService({ findById: async () => record }, { findBySurveyId: async () => [{ id: "section" }] }, { findBySectionId: async () => questions }, {}, {}, {});
    const detail = await service.findDetail(record.id, temporary);
    assert.deepEqual(detail.participationEligibility, { status: "NOT_ELIGIBLE", reasons: ["MEMBER_ACCOUNT_REQUIRED"] });
    let inserted = false;
    const responses = new SurveyResponsesService({ insertSubmission: async () => { inserted = true; } }, { findById: async () => record }, {}, { findBySurveyId: async () => [{ id: "section" }] }, { findBySectionId: async () => questions });
    await assert.rejects(responses.submit(record.id, { answers: [] }, temporary), error => error.getStatus() === 403 && error.message === "member_account_required");
    assert.equal(inserted, false);
  }
});

test("temporary and anonymous visitors can still use surveys that explicitly allow anonymous responses", async () => {
  const record = survey({ allowAnonymous: true });
  const service = new SurveyResponsesService({ insertSubmission: async input => ({ status: "created", response: { id: "response", userId: input.userId }, answers: [] }) }, { findById: async () => record }, {});
  assert.equal((await service.submit(record.id, { answers: [] }, temporary)).userId, null);
  assert.equal((await service.submit(record.id, { answers: [] })).userId, null);
});

test("scheduled messages recheck the sender before resolving recipients or entering delivery", async () => {
  for (const [sender, permission, allowed] of [[null, 0, false], [{ isActive: false }, Permissions.SEND_BULK_EMAIL, false], [{ isActive: true }, 0, false], [{ isActive: true }, Permissions.SEND_BULK_EMAIL, true]]) {
    let deliveries = 0, recipientLookups = 0;
    const service = new BulkEmailService({}, { findById: async () => sender, resolvePermissionBitmaskByUserId: async () => permission, listEmailRecipients: async () => { recipientLookups++; return [{ email: "synthetic@example.invalid" }]; } }, {}, {}, {});
    service.deliver = async () => { deliveries++; };
    const result = service.deliverStored({ id: "scheduled", senderId: "sender", recipientType: "ALL", attachmentAssetIds: [] });
    if (allowed) await result;
    else await assert.rejects(result, error => error.getStatus() === 403 && error.message === "bulk_email_sender_not_authorized");
    assert.equal(deliveries, allowed ? 1 : 0);
    assert.equal(recipientLookups, allowed ? 1 : 0);
  }
});

test("an unauthorized scheduled message is marked failed with a reason and is not polled again", async t => {
  const state = { status: "SCHEDULED", error: null, claimed: 0 };
  const record = { id: "scheduled", senderId: "disabled" };
  const service = new BulkEmailService({
    findDueScheduled: async () => state.status === "SCHEDULED" ? [record.id] : [],
    claimScheduled: async () => { state.claimed++; state.status = "PENDING"; return record; },
    updateStatus: async (_id, status, error) => { state.status = status; state.error = error; },
  }, { findById: async () => ({ isActive: false }) }, { send: async () => { throw new Error("unexpected_SMTP_call"); } }, {}, {});
  t.mock.method(service.logger, "error", () => {});
  await service.processScheduledEmails();
  await service.processScheduledEmails();
  assert.equal(state.status, "FAILED");
  assert.equal(state.error, "bulk_email_sender_not_authorized");
  assert.equal(state.claimed, 1);
});

const url = process.env.ADMIN_UI_TEST_DATABASE_URL;
if (url && !/^\/soc_admin_ui_test_\d+$/.test(new URL(url).pathname)) throw new Error("isolated_test_database_required");
let pool, db;
before(async () => { if (url) { pool = new Pool({ connectionString: url }); db = drizzle(pool, { schema }); } });
after(async () => { if (pool) await pool.end(); });

test("an identified single-response survey blocks temporary submissions and still enforces the member limit", { skip: !url }, async () => {
  const [member] = await db.insert(schema.users).values({ kaistUid: "synthetic-member", nameKo: "합성 회원", email: "member@example.invalid" }).returning();
  const [row] = await db.insert(schema.surveys).values({ titleKo: "합성 단일 응답", kind: "SURVEY", isPublished: true, lifecycleStatus: "PUBLISHED", isAlwaysOpen: true }).returning();
  const record = survey({ ...row, id: row.surveyId });
  const service = new SurveyResponsesService(new SurveyResponsesRepository(db), { findById: async () => record }, {});
  await assert.rejects(service.submit(row.surveyId, { answers: [] }, temporary), /member_account_required/);
  const memberCaller = { id: member.userId, permission: 0 };
  await service.submit(row.surveyId, { answers: [] }, memberCaller);
  await assert.rejects(service.submit(row.surveyId, { answers: [] }, memberCaller), /already_submitted/);
  assert.equal((await db.select().from(schema.surveyResponses)).length, 1);
});

test("concurrent repeated account changes send one deactivation notice and one recovery notice", { skip: !url }, async () => {
  const [member] = await db.insert(schema.users).values({ kaistUid: "synthetic-account", nameKo: "합성 계정", email: "account@example.invalid" }).returning();
  const emails = [], audits = [];
  const repository = new UsersRepository(db, { del: async () => 1 }, {});
  const service = new UsersService(repository, { record: async entry => audits.push(entry) }, { send: async message => emails.push(message) });
  await Promise.all([service.setAccountActive(member.userId, false, undefined, "합성 사유"), service.setAccountActive(member.userId, false, undefined, "합성 사유")]);
  await service.setAccountActive(member.userId, false, undefined, "합성 사유");
  assert.equal(emails.length, 1);
  assert.match(emails[0].content, /합성 사유/);
  await Promise.all([service.setAccountActive(member.userId, true), service.setAccountActive(member.userId, true)]);
  assert.equal(emails.length, 2);
  assert.match(emails[1].subject, /복구 완료/);
  assert.equal(audits.length, 2);
});
