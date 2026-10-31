const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { AuditLogRepository } = require("../dist/apps/api/src/features/audit/audit-log.repository.js");
const { auditMetadataFromRequest, normalizeAuditIp } = require("../dist/apps/api/src/features/audit/audit-context.js");
const url = process.env.ADMIN_UI_TEST_DATABASE_URL;
if (url && !/^\/soc_admin_ui_test_\d+$/.test(new URL(url).pathname)) throw new Error("isolated_admin_audit_test_database_required");
const integration = { skip: !url };
let pool, db;
before(async () => { if (url) { pool = new Pool({ connectionString: url }); db = drizzle(pool, { schema }); } });
beforeEach(async () => { if (pool) await pool.query("TRUNCATE users, audit_log, paid_student_records CASCADE"); });
after(async () => { if (pool) await pool.end(); });

test("fee logs resolve registered and unregistered people and classify roster reads as fee work", integration, async () => {
  const id = randomUUID();
  await db.insert(schema.users).values({ userId: id, kaistUid: "audit-synthetic", nameKo: "합성 사용자", stdNo: "20260001", email: "audit@example.invalid" });
  await db.insert(schema.paidStudentRecords).values({ stdNo: "20260002", nameKo: "미가입 합성", paidAmount: 0, paidSemesters: 0 });
  const repo = new AuditLogRepository(db);
  const audit = auditMetadataFromRequest({ ip: "::ffff:203.0.113.5", user: { id } });
  await repo.create({ ...audit, action: "student_fee.roster.list", targetType: "paid_student_records", payload: { count: 12 } });
  await repo.create({ ...audit, action: "student_fee_status.detail", targetType: "paid_student_records", targetId: id });
  await repo.create({ ...audit, action: "student_fee_status.detail", targetType: "paid_student_records", targetId: "20260002" });
  const listed = await repo.list({ targetType: "paid_student_records" });
  assert.equal(listed.total, 3);
  assert.ok(listed.items.every(item => item.domain === "fee" && item.domainLabel === "과비" && item.ipAddress === "203.0.113.5"));
  assert.equal(listed.items.find(item => item.action === "student_fee.roster.list").targetLabel, "과비 납부 명부 12명");
  assert.equal(listed.items.find(item => item.targetId === id).targetLabel, "합성 사용자 (20260001)");
  assert.equal(listed.items.find(item => item.targetId === "20260002").targetLabel, "미가입 합성 (20260002)");
});

test("new operations have explicit action labels and historical mapped IPv4 is readable", integration, async () => {
  const repo = new AuditLogRepository(db);
  for (const [action, targetType] of [["student_fee_policy.create", "student_fee_policy"], ["survey.structure.restore", "survey"], ["survey_response.delete_all", "survey"], ["bulk_email.recover", "bulk_email"], ["vote.results.unpublish", "vote"]]) {
    await db.insert(schema.auditLogs).values({ action, targetType, ipAddress: "::ffff:203.0.113.6" });
  }
  const listed = await repo.list({});
  assert.ok(listed.items.every(item => item.eventKind !== "OTHER" && item.ipAddress === "203.0.113.6"));
  const policy = listed.items.find(item => item.action === "student_fee_policy.create");
  assert.equal(policy.domain, "fee");
  assert.equal(policy.actionLabel, "표준 과비 설정");
  assert.equal(policy.targetLabel, "과비 설정");
});

test("IP normalization preserves valid IPv6 and never treats arbitrary header text as an address", () => {
  assert.equal(normalizeAuditIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeAuditIp("2001:db8::1"), "2001:db8::1");
  assert.equal(normalizeAuditIp("203.0.113.5, 172.18.0.1"), null);
  assert.equal(normalizeAuditIp("not-an-ip"), null);
  assert.equal(normalizeAuditIp(undefined), null);
});
