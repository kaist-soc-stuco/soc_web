const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { SurveyResponsesRepository } = require("../dist/apps/api/src/features/surveys/survey-responses.repository.js");

const databaseUrl = process.env.FEE_ROSTER_TEST_DATABASE_URL;
if (databaseUrl && !/^\/(soc_fee_roster_test_\w+|soc_web_test)$/.test(new URL(databaseUrl).pathname)) throw new Error("isolated_fee_policy_test_database_required");
if (process.env.CI && !databaseUrl) throw new Error("FEE_ROSTER_TEST_DATABASE_URL_is_required_in_CI");
const integration = { skip: !databaseUrl };
let pool, db, repository, responses;
before(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl, max: 10 });
  db = drizzle(pool, { schema });
  repository = new UsersRepository(db, null, null);
  responses = new SurveyResponsesRepository(db);
});
beforeEach(async () => {
  if (pool) await pool.query("TRUNCATE users, paid_student_records, survey RESTART IDENTITY CASCADE");
});
after(async () => { if (pool) await pool.end(); });
async function member(stdNo = "90990001") {
  const id = randomUUID();
  await db.insert(schema.users).values({ userId: id, stdNo, kaistUid: `fee-${id.slice(0, 15)}`, nameKo: "합성 정책 사용자", email: `${id}@example.invalid` });
  return id;
}
async function baseline(stdNo, paidAmount, paidSemesters = 2) {
  await repository.importStudentFeeRoster([{ stdNo, paidAmount, paidSemesters, admissionYear: 2020, nameKo: "합성 정책 사용자" }]);
}
function payment(target, amount, key = randomUUID()) {
  return { idempotencyKey: key, payments: [{ ...target, amount, paymentType: "PRIOR_PAYMENT_BALANCE", paymentMethod: "BANK_TRANSFER",
    effectiveStartSemester: "2020-1", coverageSemesters: 1, paidAt: "2020-01-01T00:00:00.000Z" }] };
}
async function accept(userId) {
  const state = await repository.getStudentFeeConsent(userId);
  return repository.setStudentFeeConsent(userId, { semester: state.semester, noticeVersion: state.noticeVersion, consented: true });
}
async function survey(userId, paidOnly = true) {
  const id = randomUUID();
  await db.insert(schema.surveys).values({ surveyId: id, creatorId: userId, kind: "SURVEY", titleKo: "합성 정책 설문",
    isPublished: true, lifecycleStatus: "PUBLISHED", isAlwaysOpen: true, allowResponseEdit: true,
    feeRequirementPolicy: paidOnly ? "PAID_ONLY" : "ANY" });
  return id;
}

test("historical completion stays paid across semesters and price increases without a top-up", integration, async () => {
  const id = await member();
  await db.insert(schema.studentFeeStatus).values({ userId: id, status: "PAID", paidAmount: 30000, coverageSemesters: 1, paidAt: new Date("2019-01-01Z") });
  await repository.createStudentFeePolicy({ effectiveSemester: "2026-1", amount: 60000, coverageSemesters: 6 }, id);
  const status = await repository.getStudentFeeStatus(id);
  assert.equal(status.status, "PAID");
  assert.equal(status.paidAmount, 30000);
  assert.equal(status.remainingAmount, 0);
  assert.equal((await repository.listStudentFeeRoster("2035-2")).find(row => row.userId === id).status, "PAID");
  const stats = await repository.getStudentFeeStats({ referenceSemester: "2026-2" });
  assert.equal(stats.totals.outstandingAmount, 0);
  await assert.rejects(repository.processStudentFeePayments(payment({ userId: id }, 15000), id), /fee_already_paid/);
});

test("partial payments accumulate on the imported baseline and complete only at the remaining balance", integration, async () => {
  const id = await member();
  await baseline("90990001", 10000);
  const first = payment({ userId: id }, 10000);
  const result = await repository.processStudentFeePayments(first, id);
  assert.equal(result.updated[0].status, "PARTIAL");
  let status = await repository.getStudentFeeStatus(id);
  assert.equal(status.paidAmount, 20000);
  assert.equal(status.remainingAmount, 25000);
  assert.deepEqual(await repository.processStudentFeePayments(first, id), result);
  await assert.rejects(repository.processStudentFeePayments(payment({ userId: id }, 25001), id), /fee_payment_exceeds_balance/);
  await assert.rejects(repository.processStudentFeePayments(payment({ userId: id }, 0), id), /fee_payment_amount_invalid/);
  await repository.processStudentFeePayments(payment({ userId: id }, 25000), id);
  status = await repository.getStudentFeeStatus(id);
  assert.equal(status.status, "PAID");
  assert.equal(status.paidAmount, 45000);
  assert.equal(status.remainingAmount, 0);
  const detail = await repository.getStudentFeeDetail(id, "2035-2");
  assert.equal(detail.status.status, "PAID");
  assert.equal(detail.history.length, 2);
  assert.equal((await repository.listStudentFeeRoster("2035-2")).find(row => row.userId === id).totalPaidAmount, 45000);
});

test("completion before account creation survives login and a higher fee without double counting receipts", integration, async () => {
  const actor = await member("90990099");
  await baseline("90990001", 10000);
  await repository.processStudentFeePayments(payment({ stdNo: "90990001" }, 35000), actor);
  await repository.createStudentFeePolicy({ effectiveSemester: "2026-1", amount: 60000, coverageSemesters: 6 }, actor);
  const id = await member();
  await repository.linkInitialStudentFeeRecord(id, "90990001");
  assert.equal((await repository.getStudentFeeStatus(id)).status, "PAID");
  const detail = await repository.getStudentFeeRosterDetail(id, "2035-2");
  assert.equal(detail.record.totalPaidAmount, 45000);
  assert.equal(detail.record.remainingAmount, 0);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].userId, id);
});

test("concurrent distinct receipts cannot exceed the balance and mixed batches roll back atomically", integration, async () => {
  const id = await member();
  const attempts = await Promise.allSettled([
    repository.processStudentFeePayments(payment({ userId: id }, 30000), id),
    repository.processStudentFeePayments(payment({ userId: id }, 30000), id),
  ]);
  assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
  assert.match(attempts.find(item => item.status === "rejected").reason.message, /fee_payment_exceeds_balance/);
  assert.equal((await repository.getStudentFeeStatus(id)).paidAmount, 30000);
  await repository.processStudentFeePayments(payment({ userId: id }, 15000), id);
  const other = await member("90990002");
  const mixed = payment({ userId: other }, 10000);
  mixed.payments.push(payment({ userId: id }, 1).payments[0]);
  await assert.rejects(repository.processStudentFeePayments(mixed, other), /fee_already_paid/);
  assert.equal((await repository.getStudentFeeStatus(other)).paidAmount, 0);
  assert.equal((await db.select().from(schema.studentFeePayments)).length, 2);
});

test("semester consent is explicit, idempotent and independent of login consent and payment history", integration, async () => {
  const id = await member();
  await baseline("90990001", 30000, 6);
  await db.update(schema.users).set({ privacyConsentAt: new Date() }).where(eq(schema.users.userId, id));
  const financial = await repository.getStudentFeeStatus(id);
  const initial = await repository.getStudentFeeConsent(id);
  assert.equal(initial.consented, false);
  const agreed = await accept(id);
  assert.equal(agreed.consented, true);
  assert.deepEqual(await accept(id), agreed);
  await assert.rejects(repository.setStudentFeeConsent(id, { ...initial, semester: "2099-1", consented: true }), /fee_consent_notice_changed/);
  await assert.rejects(repository.setStudentFeeConsent(id, { ...initial, noticeVersion: "obsolete", consented: true }), /fee_consent_notice_changed/);
  const withdrawn = await repository.setStudentFeeConsent(id, { ...initial, consented: false });
  assert.equal(withdrawn.consented, false);
  assert.ok(withdrawn.withdrawnAt);
  assert.deepEqual(await repository.getStudentFeeStatus(id), financial);
  await accept(id);
  await db.update(schema.studentFeeConsents).set({ semester: "1900-1" }).where(eq(schema.studentFeeConsents.userId, id));
  assert.equal((await repository.getStudentFeeConsent(id)).consented, false);
  assert.deepEqual(await repository.getStudentFeeStatus(id), financial);
});

test("paid-only submissions and edits independently require current consent; ordinary surveys do not", integration, async () => {
  const id = await member();
  await baseline("90990001", 30000, 6);
  const gated = await survey(id);
  assert.equal((await responses.insertSubmission({ surveyId: gated, userId: id, answers: [] })).status, "fee_consent_required");
  const ordinary = await survey(id, false);
  assert.equal((await responses.insertSubmission({ surveyId: ordinary, userId: id, answers: [] })).status, "created");
  await accept(id);
  const submitted = await responses.insertSubmission({ surveyId: gated, userId: id, answers: [] });
  assert.equal(submitted.status, "created");
  const consent = await repository.getStudentFeeConsent(id);
  await repository.setStudentFeeConsent(id, { ...consent, consented: false });
  assert.equal((await responses.updateSubmission({ responseId: submitted.response.id, surveyId: gated, userId: id, answers: [] })).status, "fee_consent_required");
  assert.equal((await repository.getStudentFeeStatus(id)).status, "PAID");
});

test("migration retains historical completions and baselines without counting the latest receipt twice or inferring consent", integration, async () => {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("DROP TABLE student_fee_consent; ALTER TABLE paid_student_records DROP COLUMN completed_at; ALTER TABLE student_fee_status DROP COLUMN initial_paid_amount");
    const complete = randomUUID(), partial = randomUUID();
    await connection.query(`INSERT INTO users (user_id, kaist_uid, std_no, name_ko, email, privacy_consent_at)
      VALUES ($1, 'migration-complete', '90990001', 'Synthetic', 'complete@example.invalid', now()),
             ($2, 'migration-partial', '90990002', 'Synthetic', 'partial@example.invalid', now())`, [complete, partial]);
    await connection.query(`INSERT INTO student_fee_status (user_id, status, paid_amount, coverage_semesters)
      VALUES ($1, 'PAID', 30000, 1), ($2, 'PARTIAL', 5000, 1)`, [complete, partial]);
    await connection.query(`INSERT INTO paid_student_records (std_no, admission_year, paid_semesters, paid_amount)
      VALUES ('90990001', 2020, 6, 30000), ('90990002', 2020, 2, 10000)`);
    await connection.query(`INSERT INTO student_fee_payment (user_id, amount, payment_type, payment_method, effective_start_semester, coverage_semesters, paid_at)
      VALUES ($1, 5000, 'PRIOR_PAYMENT_BALANCE', 'BANK_TRANSFER', '2020-1', 1, now())`, [partial]);
    const migration = readFileSync(join(__dirname, "../drizzle/0003_lifetime_fee_policy.sql"), "utf8");
    await connection.query(migration);
    const balances = (await connection.query("SELECT user_id, initial_paid_amount FROM student_fee_status")).rows;
    assert.equal(balances.find(row => row.user_id === complete).initial_paid_amount, 30000);
    assert.equal(balances.find(row => row.user_id === partial).initial_paid_amount, 0);
    const roster = (await connection.query("SELECT std_no, completed_at FROM paid_student_records")).rows;
    assert.ok(roster.find(row => row.std_no === "90990001").completed_at);
    assert.equal(roster.find(row => row.std_no === "90990002").completed_at, null);
    assert.equal((await connection.query("SELECT count(*)::int AS n FROM student_fee_consent")).rows[0].n, 0);
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
});
