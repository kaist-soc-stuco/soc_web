const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq, inArray } = require("drizzle-orm");
const { CreateVoteSchema } = require("@soc/contracts");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { ContactsRepository } = require("../dist/apps/api/src/features/contacts/contacts.repository.js");
const { VotesRepository } = require("../dist/apps/api/src/features/votes/votes.repository.js");
const { VotesService } = require("../dist/apps/api/src/features/votes/votes.service.js");

test("quorum defaults and input boundaries are explicit", () => {
  const value = { titleKo: "합성 선거", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-02T00:00:00Z", items: [{ titleKo: "선택", type: "SINGLE_CHOICE", options: [{ labelKo: "A" }, { labelKo: "B" }] }] };
  assert.equal(CreateVoteSchema.parse(value).quorumPercent, 50);
  assert.equal(CreateVoteSchema.parse(value).quorumInclusive, true);
  for (const quorumPercent of [-1, 100.1, 101]) assert.equal(CreateVoteSchema.safeParse({ ...value, quorumPercent }).success, false);
  for (const quorumPercent of [0, 50, 100]) assert.equal(CreateVoteSchema.safeParse({ ...value, quorumPercent }).success, true);
});

test("below-quorum tally is rejected before decrypting ballots", async () => {
  const service = new VotesService({ findVote: async () => ({ status: "CLOSED", quorumPercent: 50, quorumInclusive: true }), counts: async () => ({ eligibleCount: 101, votedCount: 50 }) }, {});
  await assert.rejects(service.tally(randomUUID()), /vote_quorum_not_met/);
});

test("fee states, contact history, and atomic quorum on isolated PostgreSQL", { skip: !process.env.FEEDBACK_TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.FEEDBACK_TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const voteId = randomUUID();
  let contact;
  try {
    await db.insert(schema.users).values(ids.map((userId, index) => ({ userId, kaistUid: `fb-${userId.slice(0, 16)}`, nameKo: `피드백 검증 ${index}`, email: `${userId}@example.test`, isActive: true })));
    await db.insert(schema.studentFeeStatus).values(ids.map((userId, index) => ({ userId, status: "PARTIAL", paidAmount: index ? 10000 : 0, coverageSemesters: 6, paidAt: index === 2 ? new Date("2020-01-01T00:00:00Z") : null })));
    const users = new UsersRepository(db, { del: async () => 0 }, { get: () => undefined });
    const all = await users.listStudentsByFeeStatus(undefined, 1, 20, "name", "asc", undefined, undefined, undefined, "2026-2", ids);
    assert.equal(all.students.find((row) => row.userId === ids[0]).status, "UNPAID");
    assert.equal(all.students.find((row) => row.userId === ids[1]).status, "PARTIAL");
    assert.equal(all.students.find((row) => row.userId === ids[2]).status, "UNPAID");
    assert.equal(all.summary.partialStudents, 1);
    const partial = await users.listStudentsByFeeStatus("PARTIAL", 1, 20, "name", "asc", undefined, undefined, undefined, "2026-2", ids);
    assert.deepEqual(partial.students.map((row) => row.userId), [ids[1]]);
    assert.equal((await users.getStudentFeeStatus(ids[0])).status, "UNPAID");
    await users.createStudentFeePolicy({ effectiveSemester: "2099-1", amount: 55000, coverageSemesters: 6 }, ids[0]);
    assert.equal((await users.getStudentFeePolicy("2098-2")).amount, 45000);
    assert.equal((await users.getStudentFeePolicy("2099-1")).amount, 55000);
    assert.equal((await users.getStudentFeeStatus(ids[1])).paidAmount, 10000);

    const contacts = new ContactsRepository(db);
    contact = await contacts.insert({ nameKo: "합성 구성원", nameEn: "Fixture Member", roleKo: "회장", roleEn: "President", privacyConsented: true, publiclyListed: false, portalUserId: ids[0], activities: [{ year: 2025, departmentKo: "기획", departmentEn: "Planning", roleKo: "부원", roleEn: "Member" }, { year: 2026, departmentKo: "회장단", departmentEn: "Presidium", roleKo: "회장", roleEn: "President" }] });
    assert.equal((await contacts.findById(contact.id)).activities.length, 2);
    assert.equal((await contacts.findManaged({ cohort: 2025, department: "기획" })).items.some((row) => row.id === contact.id), true);
    assert.equal((await contacts.findManaged({ cohort: 2025, department: "회장단" })).items.some((row) => row.id === contact.id), false);
    const { UsersService } = require("../dist/apps/api/src/features/users/users.service.js");
    const service = new UsersService(users);
    const preview = await service.previewStudentFeeImport({ updates: [{ userId: ids[1], status: "PAID" }, { userId: ids[1], status: "PAID" }, { userId: randomUUID(), status: "PAID" }] });
    assert.equal(preview.canApply, false);
    assert.equal(preview.rows[0].current.paidAmount, 10000);
    assert.equal(preview.rows[1].error, "DUPLICATE_USER");
    assert.equal(preview.rows[2].error, "USER_NOT_FOUND");
    assert.equal((await users.getStudentFeeStatus(ids[1])).status, "PARTIAL");
    assert.equal((await contacts.findPublic()).items.some((row) => row.nameKo === contact.nameKo), false);

    const votes = new VotesRepository(db);
    await db.insert(schema.votes).values({ voteId, creatorId: ids[0], titleKo: "합성 개표", status: "CLOSED", startsAt: new Date("2026-01-01"), endsAt: new Date("2026-01-02"), quorumPercent: 50, quorumInclusive: false });
    await db.insert(schema.voteVoters).values(ids.slice(0, 2).map((userId, index) => ({ voteId, userId, nameKo: "합성 선거인", email: `${userId}@example.test`, primaryMajor: "전산학부", status: "ELIGIBLE", source: "FILTER", hasVoted: index === 0 })));
    await assert.rejects(votes.saveTally(voteId, { items: [] }, 1), /vote_quorum_not_met/);
    assert.equal(await votes.findTally(voteId), null);
    await db.update(schema.votes).set({ quorumInclusive: true }).where(eq(schema.votes.voteId, voteId));
    const results = await Promise.all([votes.saveTally(voteId, { items: ["first"] }, 1), votes.saveTally(voteId, { items: ["second"] }, 1)]);
    assert.deepEqual(results[0].result, results[1].result);
    assert.equal((await votes.findVote(voteId)).status, "TALLIED");
    await assert.rejects(votes.addVoters(voteId, ids), /vote_voter_roll_locked/);
    await assert.rejects(votes.excludeVoters(voteId, ids), /vote_voter_roll_locked/);
  } finally {
    await db.delete(schema.votes).where(eq(schema.votes.voteId, voteId));
    if (contact) await db.delete(schema.executiveContacts).where(eq(schema.executiveContacts.id, contact.id));
    await db.delete(schema.studentFeePolicies).where(inArray(schema.studentFeePolicies.createdBy, ids));
    await db.delete(schema.studentFeeStatus).where(inArray(schema.studentFeeStatus.userId, ids));
    await db.delete(schema.users).where(inArray(schema.users.userId, ids));
    await pool.end();
  }
});
