const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { and, eq } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const { VotesRepository } = require("../dist/apps/api/src/features/votes/votes.repository.js");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");

const databaseUrl = process.env.VOTE_CONCURRENCY_TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) {
  throw new Error("VOTE_CONCURRENCY_TEST_DATABASE_URL_is_required_in_CI");
}
const integrationOptions = { skip: !databaseUrl };

const USER_ID = "30000000-0000-4000-8000-000000000001";
const VOTE_ID = "30000000-0000-4000-8000-000000000002";

let pool;
let db;
let repository;

before(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl, max: 8 });
  db = drizzle(pool, { schema });
  repository = new VotesRepository(db);
});

beforeEach(async () => {
  if (!db) return;
  await db.delete(schema.voteBallots).where(eq(schema.voteBallots.voteId, VOTE_ID));
  await db.delete(schema.voteVoters).where(eq(schema.voteVoters.voteId, VOTE_ID));
  await db.delete(schema.votes).where(eq(schema.votes.voteId, VOTE_ID));
  await db.delete(schema.users).where(eq(schema.users.userId, USER_ID));

  const now = Date.now();
  await db.insert(schema.users).values({
    userId: USER_ID,
    kaistUid: "vote-user-20260908",
    stdNo: "20260001",
    nameKo: "합성 투표자",
    email: "vote-concurrency@example.test",
    primaryMajor: "School of Computing",
    academicStatus: "ENROLLED",
    isActive: true,
  });
  await db.insert(schema.votes).values({
    voteId: VOTE_ID,
    creatorId: USER_ID,
    titleKo: "합성 투표",
    status: "PUBLISHED",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    academicStatuses: [],
    feePayersOnly: false,
  });
  await db.insert(schema.voteVoters).values({
    voteId: VOTE_ID,
    userId: USER_ID,
    nameKo: "합성 투표자",
    studentNumber: "20260001",
    email: "vote-concurrency@example.test",
    primaryMajor: "School of Computing",
    academicStatus: "ENROLLED",
    status: "ELIGIBLE",
    source: "FILTER",
    hasVoted: false,
  });
});

after(async () => {
  await pool?.end();
});

function ballot(receiptHash) {
  return {
    voteId: VOTE_ID,
    userId: USER_ID,
    ciphertext: "synthetic-ciphertext",
    iv: "synthetic-iv",
    authTag: "synthetic-auth-tag",
    receiptHash,
  };
}

test(
  "close before submit rejects the ballot at the locked database boundary",
  integrationOptions,
  async () => {
    assert.ok(await repository.close(VOTE_ID));
    assert.equal(await repository.submitBallot(ballot("receipt-close-first")), "vote_not_open");

    const ballots = await repository.listBallots(VOTE_ID);
    assert.equal(ballots.length, 0);
  },
);

test(
  "submit before close is accepted once and the ballot has no voter identity column",
  integrationOptions,
  async () => {
    assert.equal(await repository.submitBallot(ballot("receipt-submit-first")), "accepted");
    assert.ok(await repository.close(VOTE_ID));

    const ballots = await repository.listBallots(VOTE_ID);
    assert.equal(ballots.length, 1);
    assert.equal("userId" in ballots[0], false);
  },
);

test(
  "parallel submissions from one voter produce one ballot and one accepted result",
  integrationOptions,
  async () => {
    const results = await Promise.all([
      repository.submitBallot(ballot("receipt-parallel-a")),
      repository.submitBallot(ballot("receipt-parallel-b")),
    ]);

    assert.deepEqual([...results].sort(), ["accepted", "already_submitted"]);
    const [voter] = await db
      .select()
      .from(schema.voteVoters)
      .where(and(eq(schema.voteVoters.voteId, VOTE_ID), eq(schema.voteVoters.userId, USER_ID)));
    assert.equal(voter.hasVoted, true);
    assert.equal((await repository.listBallots(VOTE_ID)).length, 1);
  },
);
