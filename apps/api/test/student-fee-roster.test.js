const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { GoogleFeeSheetsService } = require("../dist/apps/api/src/features/users/google-fee-sheets.service.js");

const databaseUrl = process.env.FEE_ROSTER_TEST_DATABASE_URL;
if (databaseUrl && !/^\/(soc_fee_roster_test_\w+|soc_web_test)$/.test(new URL(databaseUrl).pathname)) throw new Error("isolated_fee_roster_test_database_required");
const integration = { skip: !databaseUrl };
const first = { stdNo: "90990001", nameKo: "합성 사용자", admissionYear: 2026, paidSemesters: 6, paidAmount: 30000 };
const second = { ...first, stdNo: "90990002", nameKo: "합성 미가입자", paidSemesters: 2, paidAmount: 10000 };
let pool, db, repository;

before(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzle(pool, { schema });
  repository = new UsersRepository(db, null, null);
});
beforeEach(async () => {
  if (pool) await pool.query("TRUNCATE paid_student_records, student_fee_payment, student_fee_status, users CASCADE");
});
after(async () => { if (pool) await pool.end(); });

async function addUser(stdNo, id = randomUUID()) {
  await db.insert(schema.users).values({ userId: id, kaistUid: `fixture-${stdNo}`, stdNo, nameKo: "합성 사용자", email: `${id}@example.invalid` });
  return id;
}

test("import retains unregistered students and replays never overwrite the authoritative ledger", integration, async () => {
  const userId = await addUser(first.stdNo);
  assert.deepEqual(await repository.importStudentFeeRoster([first, second]), { insertedCount: 2, linkedCount: 1 });
  assert.equal((await db.select().from(schema.paidStudentRecords)).length, 2);
  const before = await repository.getStudentFeeStatus(userId);
  assert.equal(before.status, "PAID");
  assert.deepEqual(await repository.importStudentFeeRoster([{ ...first, paidSemesters: 1, paidAmount: 1 }, second]), { insertedCount: 0, linkedCount: 0 });
  const after = await repository.getStudentFeeStatus(userId);
  assert.equal(after.paidAmount, 30000);
  assert.equal(after.updatedAt, before.updatedAt);
  const roster = await repository.listInitialStudentFeeRoster();
  assert.ok(roster.find(row => row.stdNo === first.stdNo).joinedAt instanceof Date);
  assert.equal(roster.find(row => row.stdNo === second.stdNo).joinedAt, null);
});

test("a later SSO account links from DB without reading the bootstrap file", integration, async () => {
  await repository.importStudentFeeRoster([first]);
  const userId = await addUser(first.stdNo);
  const previous = process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  process.env.STUDENT_FEE_BOOTSTRAP_PATH = "/nonexistent/private-bootstrap.json";
  try {
    const result = await repository.linkInitialStudentFeeRecord(userId, first.stdNo);
    assert.equal(result.changed, true);
    assert.equal(result.record.status, "PAID");
    assert.equal((await repository.linkInitialStudentFeeRecord(userId, first.stdNo)).changed, false);
    assert.deepEqual(await repository.linkInitialStudentFeeRecord(userId, second.stdNo), { record: null, changed: false });
  } finally {
    if (previous === undefined) delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
    else process.env.STUDENT_FEE_BOOTSTRAP_PATH = previous;
  }
});

test("import and login preserve administrator decisions and existing payment transactions", integration, async () => {
  const userId = await addUser(first.stdNo);
  await db.insert(schema.studentFeeStatus).values({ userId, status: "UNPAID", coverageSemesters: 6, paidAmount: 0, verifiedBy: userId, verifiedAt: new Date(), note: "관리자가 확인한 합성 기록" });
  assert.equal((await repository.importStudentFeeRoster([first])).linkedCount, 0);
  assert.equal((await repository.linkInitialStudentFeeRecord(userId, first.stdNo)).changed, false);
  assert.equal((await db.select().from(schema.studentFeeStatus))[0].paidAmount, 0);
  await db.update(schema.studentFeeStatus).set({ verifiedBy: null, verifiedAt: null, note: null }).where(eq(schema.studentFeeStatus.userId, userId));
  await db.insert(schema.studentFeePayments).values({ userId, amount: 5000, paymentType: "fixture", paymentMethod: "fixture", effectiveStartSemester: "2026-2", coverageSemesters: 1, paidAt: new Date() });
  assert.equal((await repository.linkInitialStudentFeeRecord(userId, first.stdNo)).changed, false);
  await db.delete(schema.studentFeeStatus).where(eq(schema.studentFeeStatus.userId, userId));
  assert.deepEqual(await repository.linkInitialStudentFeeRecord(userId, first.stdNo), { record: null, changed: false });
});

test("fee roster is not exported to Google Sheets", async () => {
  await assert.rejects(new GoogleFeeSheetsService().sync(), /google_sheets_retired/);
});

test("unregistered roster rows are editable and later link to SSO accounts", integration, async () => {
  await repository.importStudentFeeRoster([second]);
  const [before] = await repository.listStudentFeeRoster();
  assert.equal(before.userId, null);
  assert.equal(before.joinedAt, null);
  const update = { ...second, paidSemesters: 6, paidAmount: 30000, note: "합성 확인 메모", expectedUpdatedAt: before.updatedAt };
  await repository.saveStudentFeeRoster([update]);
  const [saved] = await repository.listStudentFeeRoster();
  assert.equal(saved.note, "합성 확인 메모");
  assert.notEqual(saved.updatedAt, before.updatedAt);
  const userId = await addUser(second.stdNo);
  await repository.linkInitialStudentFeeRecord(userId, second.stdNo);
  const [linked] = await repository.listStudentFeeRoster();
  assert.equal(linked.userId, userId);
  assert.ok(linked.joinedAt);
  assert.equal((await repository.getStudentFeeStatus(userId)).status, "PAID");
});

test("a stale edit rolls back every row in the same batch", integration, async () => {
  await repository.importStudentFeeRoster([first, second]);
  const originals = await repository.listStudentFeeRoster();
  const updates = originals.map(row => ({ stdNo: row.stdNo, nameKo: row.nameKo, admissionYear: row.admissionYear,
    paidSemesters: 1, paidAmount: 5000, note: null, expectedUpdatedAt: row.updatedAt }));
  updates[1].expectedUpdatedAt = "2000-01-01T00:00:00.000Z";
  await assert.rejects(repository.saveStudentFeeRoster(updates), /fee_roster_changed/);
  assert.deepEqual(await repository.listStudentFeeRoster(), originals);
});

test("only one concurrent edit with the same version succeeds", integration, async () => {
  await repository.importStudentFeeRoster([second]);
  const [row] = await repository.listStudentFeeRoster();
  const update = { ...second, note: null, expectedUpdatedAt: row.updatedAt };
  const results = await Promise.allSettled([
    repository.saveStudentFeeRoster([{ ...update, paidAmount: 15000 }]),
    repository.saveStudentFeeRoster([{ ...update, paidAmount: 20000 }]),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failure = results.find(result => result.status === "rejected");
  assert.match(failure.reason.message, /fee_roster_changed/);
});

test("new roster entries are additive and repeated creates cannot replace a row", integration, async () => {
  const update = { ...second, note: null, expectedUpdatedAt: null };
  await repository.saveStudentFeeRoster([update]);
  await assert.rejects(repository.saveStudentFeeRoster([{ ...update, paidAmount: 1 }]), /fee_roster_changed/);
  assert.equal((await repository.listStudentFeeRoster())[0].paidAmount, second.paidAmount);
});

function paymentRequest(target, idempotencyKey = randomUUID()) {
  return { idempotencyKey, payments: [{ ...target, amount: 5000, paymentType: "PRIOR_PAYMENT_BALANCE", effectiveStartSemester: "2026-2", coverageSemesters: 6, paidAt: "2026-10-29T00:00:00.000Z", note: "합성 추가 납부" }] };
}

test("unified fees include accounts without initial rows and retain unregistered students", integration, async () => {
  await repository.importStudentFeeRoster([second]);
  const userId = await addUser(first.stdNo);
  const rows = await repository.listStudentFeeRoster("2026-2");
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.stdNo === second.stdNo).userId, null);
  assert.equal(rows.find(row => row.userId === userId).updatedAt, null);
});

test("unregistered receipts survive login with the same IDs, totals, history and fee eligibility", integration, async () => {
  const actor = await addUser("90990099");
  await repository.importStudentFeeRoster([second]);
  const request = paymentRequest({ stdNo: second.stdNo });
  const created = await repository.processStudentFeePayments(request, actor);
  assert.equal(created.count, 1);
  assert.equal(created.payments[0].userId, null);
  assert.deepEqual(await repository.processStudentFeePayments(request, actor), created);
  let detail = await repository.getStudentFeeRosterDetail(second.stdNo, "2026-2");
  assert.equal(detail.record.totalPaidAmount, 15000);
  assert.equal(detail.record.status, "PARTIAL");
  const userId = await addUser(second.stdNo);
  await repository.linkInitialStudentFeeRecord(userId, second.stdNo);
  await repository.linkInitialStudentFeeRecord(userId, second.stdNo);
  detail = await repository.getStudentFeeRosterDetail(userId, "2026-2");
  assert.equal(detail.record.totalPaidAmount, 15000);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].paymentId, created.payments[0].paymentId);
  assert.equal(detail.history[0].userId, userId);
  assert.equal((await repository.getStudentFeeStatus(userId)).status, "PARTIAL");
});

test("mixed registered and unregistered payments are atomic and idempotent", integration, async () => {
  const actor = await addUser("90990099");
  const userId = await addUser(first.stdNo);
  await repository.importStudentFeeRoster([{ ...first, paidSemesters: 4 }, second]);
  const request = paymentRequest({ userId });
  request.payments.push(paymentRequest({stdNo:second.stdNo}).payments[0]);
  await repository.processStudentFeePayments(request, actor);
  await repository.processStudentFeePayments(request, actor);
  const rows = await db.select().from(schema.studentFeePayments);
  assert.equal(rows.length, 2);
  const unified = await repository.listStudentFeeRoster("2026-2");
  assert.equal(unified.find(row=>row.stdNo===first.stdNo).totalPaidAmount, 35000);
  assert.equal(unified.find(row=>row.stdNo===second.stdNo).totalPaidAmount, 15000);
  const broken = paymentRequest({stdNo:second.stdNo});
  broken.payments.push(paymentRequest({stdNo:"90990111"}).payments[0]);
  await assert.rejects(repository.processStudentFeePayments(broken, actor), /fee_person_not_found/);
  assert.equal((await db.select().from(schema.studentFeePayments)).length, 2);
  const stats = await repository.getStudentFeeStats({referenceSemester:"2026-2",dateFrom:"2026-10-01",dateTo:"2026-10-31"});
  assert.equal(stats.totals.collectedAmount, 50000);
  assert.equal(stats.totals.paymentCount, 2);
  assert.equal(stats.totals.paidAmount, 10000);
});

test("parallel receipt retries and later registration never create a second receipt", integration, async () => {
  const actor = await addUser("90990099");
  await repository.importStudentFeeRoster([second]);
  const request = paymentRequest({stdNo:second.stdNo});
  const [left,right] = await Promise.all([repository.processStudentFeePayments(request,actor),repository.processStudentFeePayments(request,actor)]);
  assert.equal(left.payments[0].paymentId,right.payments[0].paymentId);
  const userId = await addUser(second.stdNo);
  await Promise.all([repository.linkInitialStudentFeeRecord(userId,second.stdNo),repository.processStudentFeePayments(paymentRequest({stdNo:second.stdNo}),actor)]);
  const rows = await db.select().from(schema.studentFeePayments);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row=>row.userId===userId));
});
