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
if (databaseUrl && !new URL(databaseUrl).pathname.startsWith("/soc_fee_roster_test_")) throw new Error("isolated_fee_roster_test_database_required");
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

test("sheet mirror keeps the initial ledger in a separate protected tab with an empty join date for unregistered students", async () => {
  const calls = [];
  const service = new GoogleFeeSheetsService({
    getOrCreateSpreadsheet: async () => ({ spreadsheetId: "synthetic-mirror", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/synthetic-mirror/edit" }),
    syncSheet: async definition => calls.push(definition),
  }, {
    exportStudentsByFeeStatus: async () => [{ userId: "synthetic-user", stdNo: first.stdNo, nameKo: first.nameKo, email: "synthetic@example.invalid", status: "PAID", coverageSemesters: 6, paidAmount: 30000, joinedAt: "2026-10-01T00:00:00.000Z" }],
    listInitialStudentFeeRoster: async () => [{ ...first, joinedAt: new Date("2026-10-01T00:00:00.000Z") }, { ...second, joinedAt: null }],
  }, {});
  await service.sync();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.at(-1), "가입 일시");
  assert.equal(calls[0].rows[0].at(-1), "2026-10-01T00:00:00.000Z");
  assert.equal(calls[1].sheetTitle, "초기 납부 명부");
  assert.equal(calls[1].rows.length, 2);
  assert.equal(calls[1].rows[1].at(-1), "");
  assert.match(calls[1].protectionDescription, /읽기 전용/);
});
