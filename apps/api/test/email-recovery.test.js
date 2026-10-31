const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, beforeEach, after, test } = require("node:test");
const { eq, inArray } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const base = "../dist/apps/api/src/";
const { BulkEmailRepository } = require(base + "features/email/bulk-email.repository.js");
const { BulkEmailService } = require(base + "features/email/bulk-email.service.js");
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const url = process.env.EMAIL_RECOVERY_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("EMAIL_RECOVERY_TEST_DATABASE_URL_is_required_in_CI");
const opts = { skip: !url };
const userId = randomUUID();
const old = new Date(Date.now() - 10 * 60_000);
const cutoff = () => new Date(Date.now() - 5 * 60_000);
let pool, db, repo;

before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url });
  db = drizzle(pool, { schema });
  repo = new BulkEmailRepository(db);
  await db.insert(schema.users).values({ userId, kaistUid: userId.slice(0, 20), nameKo: "합성 메일 관리자", email: `${userId}@example.test` });
});
beforeEach(async () => { if (db) await db.delete(schema.bulkEmails).where(eq(schema.bulkEmails.senderId, userId)); });
after(async () => {
  if (!db) return;
  try {
    await db.delete(schema.bulkEmails).where(eq(schema.bulkEmails.senderId, userId));
    await db.delete(schema.users).where(eq(schema.users.userId, userId));
  } finally { await pool.end(); }
});
async function email(status, updatedAt = old, attemptStatus) {
  const [row] = await db.insert(schema.bulkEmails).values({ senderId: userId, subject: "합성 메일", content: "합성 본문", recipientCount: 1, status, updatedAt }).returning();
  if (attemptStatus) await db.insert(schema.bulkEmailDeliveryAttempts).values({ emailId: row.id, messageId: `<${row.id}@example.test>`, attemptNumber: 1, status: attemptStatus });
  return row.id;
}

test("restart recovery closes stale pending/sending jobs and attempts without requeueing", opts, async () => {
  const pending = await email("PENDING", old, "PENDING");
  const sending = await email("SENDING", old, "SENDING");
  const accepted = await email("SENDING", old, "SENT");
  const fresh = await email("SENDING", new Date(), "SENDING");
  const finished = await Promise.all(["SUCCESS", "DRY_RUN", "SCHEDULED", "FAILED", "UNKNOWN"].map(status => email(status)));
  // A new service/repository instance sees durable records left by the previous process.
  let sent = 0;
  const restarted = new BulkEmailService(new BulkEmailRepository(db), {}, { send: async () => { sent++; } });
  restarted.logger.warn = () => {};
  await restarted.recoverInterruptedDeliveries();
  assert.equal(sent, 0);
  for (const id of [pending, sending, accepted]) {
    const row = await repo.findById(id);
    assert.equal(row.status, "UNKNOWN");
    assert.equal(row.errorMessage, "email_delivery_interrupted");
    assert.ok(row.completedAt);
    assert.equal(await repo.claimFailedForRetry(userId, id), null);
  }
  const attempts = await db.select().from(schema.bulkEmailDeliveryAttempts).where(inArray(schema.bulkEmailDeliveryAttempts.emailId, [pending, sending, accepted]));
  assert.deepEqual(new Map(attempts.map(row => [row.emailId, row.status])), new Map([[pending, "UNKNOWN"], [sending, "UNKNOWN"], [accepted, "SENT"]]));
  assert.equal((await repo.findById(fresh)).status, "SENDING");
  assert.deepEqual(await Promise.all(finished.map(async id => (await repo.findById(id)).status)), ["SUCCESS", "DRY_RUN", "SCHEDULED", "FAILED", "UNKNOWN"]);
  assert.deepEqual(await repo.recoverInterruptedDeliveries(cutoff()), []);
});

test("heartbeats protect a long-running send and recovered jobs cannot regain sending state", opts, async () => {
  const active = await email("SENDING", old, "SENDING");
  assert.equal(await repo.touchActiveDelivery(active), true);
  assert.deepEqual(await repo.recoverInterruptedDeliveries(cutoff()), []);
  const stopped = await email("SENDING", old, "SENDING");
  assert.deepEqual(await repo.recoverInterruptedDeliveries(cutoff()), [stopped]);
  assert.equal(await repo.touchActiveDelivery(stopped), false);
  assert.equal(await repo.updateStatus(stopped, "SENDING"), false);
  const [attempt] = await db.select().from(schema.bulkEmailDeliveryAttempts).where(eq(schema.bulkEmailDeliveryAttempts.emailId, stopped));
  assert.equal(await repo.finishDeliveryAttempt(attempt.attemptId, "SENT"), false);
});

test("concurrent recovery workers claim each stale job once", opts, async () => {
  const ids = await Promise.all(Array.from({ length: 4 }, () => email("PENDING")));
  const recovered = (await Promise.all([
    repo.recoverInterruptedDeliveries(cutoff(), 2),
    new BulkEmailRepository(db).recoverInterruptedDeliveries(cutoff(), 2),
  ])).flat();
  assert.equal(recovered.length, 4);
  assert.deepEqual(new Set(recovered), new Set(ids));
});

test("startup recovery and scheduled delivery run without a separate enable switch", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let recoveries = 0, scheduledQueries = 0;
  const service = new BulkEmailService({
    recoverInterruptedDeliveries: async () => { recoveries++; return []; },
    findDueScheduled: async () => { scheduledQueries++; return []; },
  }, {}, {}, { get: (key, fallback) => fallback });
  service.logger.log = () => {};
  try {
    service.onModuleInit();
    await new Promise(setImmediate);
    assert.equal(recoveries, 1);
    t.mock.timers.tick(30_000);
    await new Promise(setImmediate);
    assert.equal(recoveries, 2);
    assert.equal(scheduledQueries, 1);
  } finally { service.onModuleDestroy(); }
});
