const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const {
  UsersRepository,
} = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");

const databaseUrl = process.env.FEE_CONCURRENCY_TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) {
  throw new Error("FEE_CONCURRENCY_TEST_DATABASE_URL_is_required_in_CI");
}
const integrationOptions = { skip: !databaseUrl };

const USER_ID = "20000000-0000-4000-8000-000000000001";
const ADMIN_ONE = "20000000-0000-4000-8000-000000000002";
const ADMIN_TWO = "20000000-0000-4000-8000-000000000003";

let pool;
let repository;

before(async () => {
  if (!databaseUrl) return;

  pool = new Pool({ connectionString: databaseUrl, max: 10 });
  repository = new UsersRepository(drizzle(pool, { schema }), null, null);

  await pool.query(`
    CREATE OR REPLACE FUNCTION test_delay_student_fee_insert()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_sleep(0.1);
      RETURN NEW;
    END;
    $$
  `);
  await pool.query("DROP TRIGGER IF EXISTS test_delay_student_fee_insert ON student_fee_status");
  await pool.query(`
    CREATE TRIGGER test_delay_student_fee_insert
    BEFORE INSERT ON student_fee_status
    FOR EACH ROW
    EXECUTE FUNCTION test_delay_student_fee_insert()
  `);
});

beforeEach(async () => {
  if (!pool) return;

  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  await pool.query(
    `INSERT INTO users (user_id, kaist_uid, name_ko, email)
     VALUES ($1, 'fee-user', 'Fee User', 'fee-user@example.com'),
            ($2, 'fee-admin-one', 'Fee Admin One', 'fee-admin-one@example.com'),
            ($3, 'fee-admin-two', 'Fee Admin Two', 'fee-admin-two@example.com')`,
    [USER_ID, ADMIN_ONE, ADMIN_TWO],
  );
});

after(async () => {
  if (!pool) return;

  await pool.query("DROP TRIGGER IF EXISTS test_delay_student_fee_insert ON student_fee_status");
  await pool.query("DROP FUNCTION IF EXISTS test_delay_student_fee_insert()");
  await pool.end();
});

test(
  "serializes concurrent first fee updates without a primary-key failure",
  integrationOptions,
  async () => {
    const records = await Promise.all([
      repository.updateStudentFeeStatus(USER_ID, {
        status: "PAID",
        verifiedBy: ADMIN_ONE,
      }),
      repository.updateStudentFeeStatus(USER_ID, {
        status: "UNPAID",
        verifiedBy: ADMIN_TWO,
      }),
    ]);

    assert.deepEqual(
      records.map((record) => record.status).sort(),
      ["PAID", "UNPAID"],
    );

    const { rows } = await pool.query(
      `SELECT count(*)::int AS count
       FROM student_fee_status
       WHERE user_id = $1`,
      [USER_ID],
    );
    assert.equal(rows[0].count, 1);
  },
);

test(
  "locks reciprocal target and verifier users in one order without deadlocking",
  integrationOptions,
  async () => {
    const records = await Promise.all([
      repository.updateStudentFeeStatus(ADMIN_ONE, {
        status: "PAID",
        verifiedBy: ADMIN_TWO,
      }),
      repository.updateStudentFeeStatus(ADMIN_TWO, {
        status: "PAID",
        verifiedBy: ADMIN_ONE,
      }),
    ]);

    assert.deepEqual(
      records.map((record) => record.userId).sort(),
      [ADMIN_ONE, ADMIN_TWO].sort(),
    );

    const { rows } = await pool.query(
      `SELECT user_id AS "userId", verified_by AS "verifiedBy"
       FROM student_fee_status
       WHERE user_id = ANY($1::uuid[])
       ORDER BY user_id`,
      [[ADMIN_ONE, ADMIN_TWO]],
    );
    assert.deepEqual(rows, [
      { userId: ADMIN_ONE, verifiedBy: ADMIN_TWO },
      { userId: ADMIN_TWO, verifiedBy: ADMIN_ONE },
    ]);
  },
);

test(
  "serializes concurrent ensure and first update into one intact fee row",
  integrationOptions,
  async () => {
    await Promise.all([
      repository.ensureStudentFeeStatus(USER_ID),
      repository.updateStudentFeeStatus(USER_ID, {
        status: "PAID",
        verifiedBy: ADMIN_ONE,
      }),
    ]);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS count,
              min(status) AS status,
              min(verified_by::text) AS "verifiedBy"
       FROM student_fee_status
       WHERE user_id = $1`,
      [USER_ID],
    );
    assert.deepEqual(rows[0], {
      count: 1,
      status: "PAID",
      verifiedBy: ADMIN_ONE,
    });
  },
);
