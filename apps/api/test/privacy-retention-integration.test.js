const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { describe, test, before, beforeEach, after } = require("node:test");
const path = require("node:path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { RetentionRepository } = require("../dist/apps/api/src/features/privacy-retention/retention.repository.js");
const { VotesRepository } = require("../dist/apps/api/src/features/votes/votes.repository.js");

// Always create our own database. No test truncates or migrates the supplied source database.
const databaseUrl = process.env.PRIVACY_RETENTION_TEST_DATABASE_URL;
describe("privacy retention on an isolated PostgreSQL database", { skip: !databaseUrl }, () => {
  const databaseName = `soc_retention_test_${randomUUID().replaceAll("-", "")}`;
  const now = new Date("2026-10-28T03:00:00Z");
  const endedAt = "2026-07-30T03:00:00Z";
  const old = "2026-05-01T00:00:00Z";
  let admin, pool, repository, actor, boardId, created = false;

  before(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const target = new URL(databaseUrl);
    target.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: target.toString(), max: 6 });
    await migrate(drizzle(pool), { migrationsFolder: path.join(__dirname, "../drizzle") });
    repository = new RetentionRepository(pool);
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE users, board, survey, vote, privacy_retention_case, audit_log, executive_contact, bulk_email RESTART IDENTITY CASCADE");
    actor = randomUUID();
    await pool.query("INSERT INTO users (user_id, kaist_uid, name_ko, email) VALUES ($1, 'retention-test', '합성 사용자', 'retention@example.test')", [actor]);
    boardId = (await pool.query("INSERT INTO board (code, name_ko) VALUES ('test', '테스트') RETURNING board_id")).rows[0].board_id;
  });
  after(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${databaseName}"`);
    await admin?.end();
  });
  const count = async table => Number((await pool.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
  test("the fresh baseline is applied once and rerunning migrations preserves existing rows", async () => {
    const before = (await pool.query("SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    assert.equal(before.length, 1);
    await migrate(drizzle(pool), { migrationsFolder: path.join(__dirname, "../drizzle") });
    assert.deepEqual((await pool.query("SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows, before);
    assert.equal(await count("users"), 1);
    assert.equal(await count("board"), 1);
    assert.equal((await pool.query("SELECT name_ko FROM users WHERE user_id = $1", [actor])).rows[0].name_ko, "합성 사용자");
  });
  async function survey(kind = "SURVEY", spreadsheet = null) {
    const id = randomUUID(), section = randomUUID(), question = randomUUID(), response = randomUUID();
    await pool.query("INSERT INTO survey (survey_id, kind, title_ko, spreadsheet_id, created_at, updated_at) VALUES ($1,$2,'합성 설문',$3,$4,$4)", [id, kind, spreadsheet, old]);
    await pool.query("INSERT INTO survey_sections (id,survey_id,title_ko) VALUES ($1,$2,'섹션')", [section, id]);
    await pool.query("INSERT INTO survey_questions (id,section_id,title_ko,question_type) VALUES ($1,$2,'질문','short_text')", [question, section]);
    await pool.query("INSERT INTO survey_responses (id,survey_id,user_id,updated_at) VALUES ($1,$2,$3,$4)", [response, id, actor, old]);
    await pool.query("INSERT INTO survey_answers (response_id,question_id,content,updated_at) VALUES ($1,$2,$3,$4)", [response, question, JSON.stringify("합성 답변"), old]);
    await pool.query("INSERT INTO survey_response_subscription (survey_id,user_id) VALUES ($1,$2)", [id, actor]);
    return id;
  }
  async function finalize(id, kind = "SURVEY", extra = {}) {
    return repository.finalize({ kind, resourceId: id, endedAt, ...extra }, actor, now);
  }

  test("preview is read-only; 30-day drafts and 2/3-year logs respect their cutoffs", async () => {
    const cutoff = new Date(now.valueOf() - 30 * 86400000);
    for (const date of [cutoff, new Date(cutoff.valueOf() + 1)]) {
      await pool.query("INSERT INTO article_draft (owner_user_id,board_id,fingerprint,payload,updated_at) VALUES ($1,$2,'synthetic','{}',$3)", [actor, boardId, date]);
      await pool.query("INSERT INTO bulk_email (subject,content,recipient_count,status,updated_at) VALUES ('초안','합성',0,'DRAFT',$1)", [date]);
    }
    await pool.query("INSERT INTO bulk_email (subject,content,recipient_count,status,updated_at) VALUES ('예약','합성',0,'SCHEDULED','2020-01-01')");
    for (const [action, time] of [["auth.login.success","2024-10-28T02:59:59Z"], ["auth.login.success","2024-10-28T03:00:00Z"], ["role_group_member.add","2024-01-01"], ["role_group_member.remove","2023-10-28T02:59:59Z"]]) {
      await pool.query("INSERT INTO audit_log (action,target_type,created_at) VALUES ($1,'test',$2)", [action, time]);
    }
    const preview = await repository.run(true, now);
    assert.equal(preview.drafts, 1); assert.equal(preview.emailDrafts, 1); assert.equal(preview.auditLogs, 2);
    assert.equal(await count("article_draft"), 2); assert.equal(await count("audit_log"), 4);
    await repository.run(false, now);
    assert.equal(await count("article_draft"), 1); assert.equal(await count("bulk_email"), 2); assert.equal(await count("audit_log"), 2);
  });

  test("survey deletion removes responses, answers and subscriptions, retaining the form", async () => {
    const id = await survey();
    await finalize(id);
    await pool.query("INSERT INTO audit_log (action,target_type,target_id,payload) VALUES ('survey_response.update','survey_response',$1,$2)", [randomUUID(), JSON.stringify({ surveyId: id, before: "합성 답변" })]);
    assert.equal((await repository.run(true, now)).cases[0].count, 1);
    assert.equal(await count("survey_answers"), 1);
    const result = await repository.run(false, now);
    assert.equal(result.cases[0].blocked, undefined);
    assert.equal(await count("survey_responses"), 0); assert.equal(await count("survey_answers"), 0); assert.equal(await count("survey_response_subscription"), 0);
    assert.equal(await count("survey"), 1);
    assert.equal((await pool.query("SELECT payload FROM audit_log")).rows[0].payload, null);
    assert.ok((await repository.list())[0].completed_at);
    assert.equal((await repository.run(false, now)).cases.length, 0);
  });

  test("active holds and changed/reopened resources remain intact; external copies require separate handling", async () => {
    const held = await survey(), changed = await survey(), reopened = await survey(), external = await survey("SURVEY", "synthetic-sheet");
    for (const id of [held, changed, reopened]) await finalize(id);
    await repository.setHold("SURVEY", held, new Date("2026-10-29T00:00:00Z"), "법적 보존 사유: 합성 테스트", now);
    await pool.query("UPDATE survey_answers SET updated_at = $2 WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id = $1)", [changed, now]);
    await pool.query("UPDATE survey SET accepting_responses = true WHERE survey_id = $1", [reopened]);
    await assert.rejects(finalize(external), /external_storage_connected/);
    const result = await repository.run(false, now);
    assert.equal(result.cases.length, 2);
    assert.ok(result.cases.every(item => item.blocked === "resource_changed_or_reopened"));
    assert.equal(await count("survey_answers"), 4);
    await repository.setHold("SURVEY", held, null, undefined, now);
    await repository.run(false, now);
    assert.equal(await count("survey_answers"), 3);
  });

  test("an application needs settlement and a finalize date after the last response", async () => {
    const id = await survey("APPLICATION");
    await assert.rejects(finalize(id, "APPLICATION"), /settlement_required/);
    await assert.rejects(finalize(id, "APPLICATION", { endedAt: "2025-01-01T00:00:00Z", settledAt: "2025-02-01T00:00:00Z" }), /precedes_latest_activity/);
    await finalize(id, "APPLICATION", { endedAt: "2026-06-01T00:00:00Z", settledAt: endedAt });
    assert.equal((await repository.run(false, now)).cases[0].blocked, undefined);
    assert.equal(await count("survey_answers"), 0);
  });

  test("vote cleanup destroys ballots, voter identities and encryption keys while preserving anonymous results", async () => {
    const id = randomUUID();
    await pool.query("INSERT INTO vote (vote_id,title_ko,status,starts_at,ends_at,results_published_at,encrypted_ballot_key,key_iv,key_tag,updated_at) VALUES ($1,'합성 투표','TALLIED','2026-05-01','2026-05-02','2026-05-03','synthetic-key','iv','tag','2026-05-03')", [id]);
    await pool.query("INSERT INTO vote_voter (vote_id,user_id,name_ko,email,has_voted) VALUES ($1,$2,'합성','retention@example.test',true)", [id, actor]);
    await pool.query("INSERT INTO vote_ballot (vote_id,ciphertext,iv,auth_tag,receipt_hash) VALUES ($1,'cipher','iv','tag',$2)", [id, "0".repeat(64)]);
    await pool.query("INSERT INTO vote_tally (vote_id,result,total_ballots) VALUES ($1,$2,1)", [id, JSON.stringify({ items: [] })]);
    await finalize(id, "VOTE", { objectionEndedAt: endedAt });
    assert.equal((await repository.run(false, now)).cases[0].count, 2);
    assert.equal(await count("vote_voter"), 0); assert.equal(await count("vote_ballot"), 0);
    assert.equal((await pool.query("SELECT encrypted_ballot_key FROM vote")).rows[0].encrypted_ballot_key, null);
    const votes = new VotesRepository(drizzle(pool));
    assert.deepEqual(await votes.counts(id), { eligibleCount: 1, votedCount: 1 });
    assert.equal((await votes.list())[0].eligibleCount, 1);
    assert.deepEqual((await pool.query("SELECT result FROM vote_tally")).rows[0].result.items, []);
  });

  test("fee cleanup rejects an early semester end and removes cached copies while preserving a newer payment", async () => {
    const id = randomUUID(), remaining = randomUUID();
    await pool.query("INSERT INTO student_fee_payment (payment_id,user_id,payment_type,payment_method,effective_start_semester,coverage_semesters,paid_at,note,created_at) VALUES ($1,$2,'FULL','CASH','2020-1',6,'2020-01-01','expired-private-note','2020-01-01'), ($3,$2,'FULL','CASH','2026-1',6,'2026-01-01','current-private-note','2026-01-01')", [id, actor, remaining]);
    await pool.query("INSERT INTO student_fee_status (user_id,status,note) VALUES ($1,'PAID','expired-private-note')", [actor]);
    await pool.query("INSERT INTO student_fee_payment_batch (actor_user_id,idempotency_key,payload_hash,result) VALUES ($1,'synthetic','hash',$2)", [actor, JSON.stringify({ paymentId: id, note: "expired-private-note" })]);
    await assert.rejects(finalize(id, "FEE_PAYMENT", { endedAt: "2021-12-31T23:59:59Z", settledAt: "2022-01-01T00:00:00Z" }), /precedes_latest_activity/);
    await finalize(id, "FEE_PAYMENT", { endedAt: "2022-12-31T23:59:59.999Z", settledAt: "2023-01-01T00:00:00Z" });
    assert.equal((await repository.run(false, now)).cases[0].blocked, undefined);
    assert.equal(await count("student_fee_payment"), 1);
    assert.equal((await pool.query("SELECT note FROM student_fee_status")).rows[0].note, "current-private-note");
    assert.equal((await pool.query("SELECT result FROM student_fee_payment_batch")).rows[0].result, null);
  });

  test("expired contacts and deleted content are physically removed; published content survives", async () => {
    const contact = randomUUID();
    await pool.query("INSERT INTO executive_contact (id,name_ko,name_en,role_ko,role_en,created_at,updated_at) VALUES ($1,'합성','Synthetic','담당자','Officer',$2,$2)", [contact, old]);
    await finalize(contact, "CONTACT");
    await pool.query("INSERT INTO article (board_id,author_user_id,title_ko,content_ko,status) VALUES ($1,$2,'삭제 글','합성','DELETED'),($1,$2,'공개 글','합성','PUBLISHED')", [boardId, actor]);
    const result = await repository.run(false, now);
    assert.equal(result.deletedArticles, 1);
    assert.equal(await count("executive_contact"), 0); assert.equal(await count("article"), 1);
  });

  test("another cleanup lease prevents overlapping deletion", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(193668305,1)");
      assert.equal((await repository.run(false, now)).busy, true);
    } finally { await client.query("ROLLBACK"); client.release(); }
  });

  test("reused surveys can receive a new schedule after a fresh response, without reviving deleted answers", async () => {
    const id = await survey();
    await finalize(id);
    await repository.run(false, now);
    await assert.rejects(finalize(id), /already_completed/);
    const later = new Date("2026-11-01T03:00:00Z");
    await pool.query("UPDATE survey SET accepting_responses = true, updated_at = $2 WHERE survey_id = $1", [id, later]);
    await pool.query("INSERT INTO survey_responses (survey_id,user_id,updated_at) VALUES ($1,$2,$3)", [id, actor, later]);
    const result = await repository.finalize({ kind: "SURVEY", resourceId: id, endedAt: later.toISOString() }, actor, later);
    assert.equal(result.expires_at.toISOString(), "2027-01-30T03:00:00.000Z");
    assert.equal(await count("survey_answers"), 0);
    assert.equal((await repository.run(false, later)).cases.length, 0);
  });
});
