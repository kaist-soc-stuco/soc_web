const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { UsersService } = require("../dist/apps/api/src/features/users/users.service.js");
const url = process.env.FEE_ROSTER_TEST_DATABASE_URL;
if (url && !/^\/(soc_fee_roster_test_\w+|soc_web_test)$/.test(new URL(url).pathname)) throw new Error("isolated_fee_import_test_database_required");
const options = { skip: !url };
let pool, db, repo, service, actor;
before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url, max: 10 }); db = drizzle(pool, { schema });
  repo = new UsersRepository(db, null, null);
  service = Object.create(UsersService.prototype);
  service.usersRepository = repo; service.auditLogService = { record: async () => {} };
});
beforeEach(async () => {
  if (!url) return;
  await pool.query("TRUNCATE users, paid_student_records RESTART IDENTITY CASCADE");
  actor = randomUUID();
  await db.insert(schema.users).values({ userId: actor, kaistUid: "fee-import-admin", nameKo: "합성 관리자", email: "admin@example.invalid" });
});
after(async () => { await pool?.end(); });
const entry = (stdNo, nameKo, amount, paidDate = "2026-10-30") => ({ stdNo, nameKo, amount, paidDate, note: null });
const commit = (entries, key = randomUUID(), confirmDuplicates = false) => service.importStudentFeePayments({ entries, idempotencyKey: key, confirmDuplicates }, { actorUserId: actor });

test("Excel receipts preserve baselines, create unregistered people, and link the same receipts after SSO", options, async () => {
  const memberId = randomUUID();
  await db.insert(schema.users).values({ userId: memberId, kaistUid: "fee-member", stdNo: "90990001", nameKo: "기존 학생", email: "member@example.invalid" });
  await repo.importStudentFeeRoster([{ stdNo: "90990001", nameKo: "기존 학생", admissionYear: 2026, paidSemesters: 2, paidAmount: 10000 }]);
  const entries = [entry("90990001", "기존 학생", 15000), entry("90990001", "기존 학생", 20000, "2026-10-31"),
    entry("90990002", "미가입 학생", 12000), entry("90990002", "미가입 학생", 5000, "2026-10-31")];
  const preview = await repo.previewStudentFeePayments(entries);
  assert.ok(preview.rows.every(row => !row.error));
  assert.equal(preview.totalAmount, 52000); assert.equal(preview.newPeopleCount, 1);
  const result = await commit(entries);
  assert.equal(result.count, 4);
  assert.equal(result.payments[0].paidAt, "2026-10-29T15:00:00.000Z");
  const roster = await repo.listStudentFeeRoster();
  const existing = roster.find(row => row.stdNo === "90990001"), added = roster.find(row => row.stdNo === "90990002");
  assert.equal(existing.paidAmount, 0); assert.equal(existing.totalPaidAmount, 45000); assert.equal(existing.status, "PAID");
  const existingDetail = await repo.getStudentFeeRosterDetail("90990001");
  const baseline = existingDetail.history.filter(row => row.paymentType === "INITIAL_RECORD");
  assert.equal(baseline.length, 1);
  assert.equal(baseline[0].amount, 10000);
  assert.equal(existingDetail.history.reduce((total, row) => total + row.amount, 0), 45000);
  assert.equal(added.paidAmount, 0); assert.equal(added.totalPaidAmount, 17000); assert.equal(added.userId, null);
  const before = await repo.getStudentFeeRosterDetail("90990002");
  const newId = randomUUID();
  await db.insert(schema.users).values({ userId: newId, kaistUid: "fee-new", stdNo: "90990002", nameKo: "미가입 학생", email: "new@example.invalid" });
  await repo.linkInitialStudentFeeRecord(newId, "90990002");
  const after = await repo.getStudentFeeRosterDetail("90990002");
  assert.deepEqual(after.history.map(row => row.paymentId), before.history.map(row => row.paymentId));
  assert.equal(after.record.totalPaidAmount, 17000); assert.equal(after.record.userId, newId);
});

test("duplicate confirmation, concurrent retries, and changed payloads cannot silently duplicate receipts", options, async () => {
  const repeated = entry("90990003", "나눠 낸 학생", 22500);
  const entries = [repeated, { ...repeated }];
  const preview = await repo.previewStudentFeePayments(entries);
  assert.deepEqual(preview.rows.map(row => row.duplicate), [false, true]);
  await assert.rejects(commit(entries), /fee_import_duplicates_changed/);
  assert.equal((await db.select().from(schema.paidStudentRecords)).length, 0);
  const key = randomUUID();
  const [first, retry] = await Promise.all([commit(entries, key, true), commit(entries, key, true)]);
  assert.deepEqual(first.payments.map(row => row.paymentId), retry.payments.map(row => row.paymentId));
  assert.equal((await db.select().from(schema.studentFeePayments)).length, 2);
  await assert.rejects(commit(entries.map(row => ({ ...row, nameKo: "다른 이름" })), key, true), /fee_payment_idempotency_conflict/);
});

test("new people and all other receipts roll back when one row is stale or invalid", options, async () => {
  const original = entry("90990006", "기존 학생", 10000);
  await commit([original]);
  const entries = [entry("90990004", "등록하면 안 되는 학생", 5000), original];
  assert.equal((await repo.previewStudentFeePayments(entries)).rows[1].duplicate, true);
  await assert.rejects(commit(entries), /fee_import_duplicates_changed/);
  assert.ok(!(await repo.listStudentFeeRoster()).some(row => row.stdNo === "90990004"));
  await assert.rejects(commit([entry("90990004", "등록하면 안 되는 학생", 5000), entry("90990006", "잘못된 이름", 2000)]), /fee_import_name_mismatch/);
  await assert.rejects(commit([entry("90990004", "등록하면 안 되는 학생", 5000), entry("90990006", "기존 학생", 40000)]), /fee_payment_exceeds_balance/);
  assert.equal((await db.select().from(schema.studentFeePayments)).length, 1);
  assert.ok(!(await repo.listStudentFeeRoster()).some(row => row.stdNo === "90990004"));
});
