import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SurveysRepository } from '../src/features/surveys/surveys.repository';
import { SurveysService } from '../src/features/surveys/surveys.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for survey integration tests');
const parsedDatabaseUrl = new URL(databaseUrl);
if (
  !['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)
  || !['127.0.0.1', 'localhost', '[::1]'].includes(parsedDatabaseUrl.hostname)
  || parsedDatabaseUrl.search !== ''
  || !/^soc_web_(?:test|qa)_[a-z0-9_]+$/.test(parsedDatabaseUrl.pathname.slice(1))
) {
  throw new Error('TEST_DATABASE_URL must target a disposable local soc_web test database');
}

const migrations = resolve(__dirname, '../drizzle');
const actorId = '11111111-1111-4111-8111-111111111111';
const users = [
  actorId,
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
];
let pool: Pool;
let repository: SurveysRepository;
let service: SurveysService;

type Definition = { surveyId: string; revisionId: string; questions: Record<string, string>; choices: Record<string, string[]> };
const phoneHash = (value: string) => createHash('sha256').update(value).digest('base64url');

/** Uses only a caller-provided PostgreSQL TEST_DATABASE_URL; no Docker or containers. */
describe('survey and matcher PostgreSQL protocol', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 12 });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: migrations });
    repository = new SurveysRepository(db as never);
    service = new SurveysService(
      repository,
      { hasPermission: async () => true } as never,
      {} as never,
      {} as never,
    );
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE survey_audit_log, survey_response_answers, survey_responses, survey_exports, survey_choice_options, survey_questions, survey_sections, survey_revisions, content_matchers, surveys, events CASCADE');
    await pool.query("DELETE FROM articles WHERE title_kr = 'survey integration article'");
    for (const [index, id] of users.entries()) {
      await pool.query(`INSERT INTO users (id, sso_user_id, sso_subject, fee_status)
        VALUES ($1::uuid, $2::text, $3::text, CASE WHEN $1::uuid = $4::uuid THEN 'PAID'::fee_status ELSE 'UNPAID'::fee_status END)
        ON CONFLICT (id) DO UPDATE SET sso_user_id = EXCLUDED.sso_user_id, sso_subject = EXCLUDED.sso_subject, fee_status = EXCLUDED.fee_status`,
      [id, `surveys-int-${index}`, `surveys-int-subject-${index}`, actorId]);
    }
  });
  afterAll(async () => { await pool?.end(); });

  async function definition(options: { cap?: number | null; paid?: boolean; required?: boolean; state?: 'DRAFT' | 'OPEN'; types?: string[]; validationRegex?: string } = {}): Promise<Definition> {
    const survey = await pool.query<{ id: string }>(`INSERT INTO surveys
      (state, guest_allowed, phone_required, fee_restriction, cap, closes_at, response_retention_days, created_by_user_id, updated_by_user_id)
      VALUES ('DRAFT', true, true, $1::survey_fee_restriction, $2, '2099-01-01T00:00:00.000Z', 7, $3, $3) RETURNING id`,
    [options.paid ? 'PAID_ONLY' : 'ANY', options.cap ?? null, actorId]);
    const surveyId = survey.rows[0]!.id;
    const revision = await pool.query<{ id: string }>(`INSERT INTO survey_revisions
      (survey_id, revision, title_kr, title_en, created_by_user_id) VALUES ($1, 1, '설문', 'survey', $2) RETURNING id`, [surveyId, actorId]);
    const revisionId = revision.rows[0]!.id;
    const section = await pool.query<{ id: string }>(`INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 0, '섹션', 'section') RETURNING id`, [revisionId]);
    const questions: Record<string, string> = {};
    const choices: Record<string, string[]> = {};
    for (const [ordinal, type] of (options.types ?? ['SHORT_TEXT']).entries()) {
      const row = await pool.query<{ id: string }>(`INSERT INTO survey_questions
        (section_id, ordinal, type, prompt_kr, prompt_en, required, validation_regex, number_min, number_max, date_min, date_max)
        VALUES ($1, $2, $3::survey_question_type, $3, $3, $4, CASE WHEN $3 IN ('SHORT_TEXT', 'LONG_TEXT') THEN $5::text END,
          CASE WHEN $3 = 'NUMBER' THEN 1 END, CASE WHEN $3 = 'NUMBER' THEN 10 END,
          CASE WHEN $3 = 'DATE' THEN '2026-01-01'::date END, CASE WHEN $3 = 'DATE' THEN '2026-12-31'::date END) RETURNING id`, [section.rows[0]!.id, ordinal, type, options.required ?? false, options.validationRegex ?? '^[A-Za-z ]+$']);
      questions[type] = row.rows[0]!.id;
      if (type.includes('CHOICE')) {
        const ids: string[] = [];
        for (const value of ['one', 'two']) {
          const choice = await pool.query<{ id: string }>('INSERT INTO survey_choice_options (question_id, ordinal, value_kr, value_en) VALUES ($1, $2, $3, $3) RETURNING id', [row.rows[0]!.id, ids.length, value]);
          ids.push(choice.rows[0]!.id);
        }
        choices[type] = ids;
      }
    }
    if ((options.state ?? 'OPEN') === 'OPEN') {
      await pool.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [revisionId]);
      await pool.query("UPDATE surveys SET state = 'OPEN' WHERE id = $1", [surveyId]);
    }
    return { surveyId, revisionId, questions, choices };
  }

  async function response(d: Definition, campusUserId: string | null, suffix: string, deadline = new Date('2099-01-08T00:00:00.000Z')) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const hash = phoneHash(suffix);
      const row = await client.query<{ id: string }>(`INSERT INTO survey_responses
        (survey_id, survey_revision_id, campus_user_id, guest_phone_ciphertext, guest_phone_hash, guest_phone_hash_version, state, submitted_at, retention_deadline_at, created_at)
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          CASE WHEN $3::uuid IS NULL THEN $4::text END,
          CASE WHEN $3::uuid IS NULL THEN $5::text END,
          CASE WHEN $3::uuid IS NULL THEN 'v1'::text END,
          'SUBMITTED',
          now(),
          $6::timestamptz,
          LEAST(now(), $6::timestamptz - interval '1 second')
        ) RETURNING id`,
      [d.surveyId, d.revisionId, campusUserId, `cipher-${suffix}`, hash, deadline]);
      const responseId = row.rows[0]!.id;
      if (!campusUserId) {
        await client.query(
          'INSERT INTO survey_guest_identity_hashes (survey_id, response_id, key_version, hash) VALUES ($1, $2, $3, $4)',
          [d.surveyId, responseId, 'v1', hash],
        );
      }
      await client.query('COMMIT');
      return responseId;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }


  it('decodes and serializes the review queue aggregate timestamp', async () => {
    const d = await definition();
    await response(d, users[1]!, 'review-queue');

    const rows = await repository.reviewQueue();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      surveyId: d.surveyId,
      responseCount: 1,
    });
    expect(rows[0]!.latestResponseAt).toBeInstanceOf(Date);

    await expect(service.reviewQueue(actorId, 'ko')).resolves.toEqual({
      items: [{
        surveyId: d.surveyId,
        title: { value: '설문', translationUnavailable: false },
        state: 'OPEN',
        responseCount: 1,
        latestResponseAt: rows[0]!.latestResponseAt!.toISOString(),
      }],
    });
  });
  it('durably locks published revisions while allowing new unlocked revision scaffolding', async () => {
    const d = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    const publishedAt = new Date('2026-07-27T12:00:00.000Z');
    await expect(repository.publish(d.surveyId, actorId, publishedAt, 'publish-lock')).resolves.toMatchObject({ id: d.surveyId, state: 'OPEN' });
    await expect(pool.query('SELECT published_at FROM survey_revisions WHERE id = $1', [d.revisionId])).resolves.toMatchObject({
      rows: [{ published_at: publishedAt }],
    });
    await pool.query("UPDATE surveys SET state = 'DRAFT' WHERE id = $1", [d.surveyId]);
    await pool.query("UPDATE surveys SET state = 'ARCHIVED' WHERE id = $1", [d.surveyId]);
    const revision2 = await pool.query<{ id: string }>(`INSERT INTO survey_revisions
      (survey_id, revision, title_kr, title_en, created_by_user_id) VALUES ($1, 2, '새 설문', 'new', $2) RETURNING id`, [d.surveyId, actorId]);
    const unlockedSection = await pool.query<{ id: string }>(`INSERT INTO survey_sections
      (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 0, '새 섹션', 'new') RETURNING id`, [revision2.rows[0]!.id]);
    const lockedSection = await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId]);
    const unlockedQuestion = await pool.query<{ id: string }>(`INSERT INTO survey_questions
      (section_id, ordinal, type, prompt_kr, prompt_en) VALUES ($1, 0, 'SINGLE_CHOICE', 'new', 'new') RETURNING id`, [unlockedSection.rows[0]!.id]);
    const unlockedChoice = await pool.query<{ id: string }>('INSERT INTO survey_choice_options (question_id, ordinal, value_kr, value_en) VALUES ($1, 0, $2, $2) RETURNING id', [unlockedQuestion.rows[0]!.id, 'new']);
    await expect(pool.query("INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 99, '새 섹션', 'new')", [d.revisionId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO survey_questions (section_id, ordinal, type, prompt_kr, prompt_en) VALUES ($1, 99, 'SHORT_TEXT', 'new', 'new')", [lockedSection.rows[0]!.id])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO survey_choice_options (question_id, ordinal, value_kr, value_en) VALUES ($1, 99, 'new', 'new')", [d.questions.SINGLE_CHOICE])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_revisions SET published_at = now(), title_en = 'changed' WHERE id = $1", [revision2.rows[0]!.id])).rejects.toMatchObject({ code: '23514', message: 'published_survey_definition_immutable' });
    await expect(pool.query("UPDATE survey_revisions SET title_en = 'changed' WHERE id = $1", [d.revisionId])).rejects.toMatchObject({ code: '23514', message: 'published_survey_definition_immutable' });
    await expect(pool.query('DELETE FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE survey_questions SET prompt_en = $2 WHERE id = $1', [d.questions.SINGLE_CHOICE, 'changed'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE survey_sections SET survey_revision_id = $2 WHERE id = $1', [unlockedSection.rows[0]!.id, d.revisionId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE survey_questions SET section_id = $2 WHERE id = $1', [unlockedQuestion.rows[0]!.id, lockedSection.rows[0]!.id])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE survey_choice_options SET question_id = $2 WHERE id = $1', [unlockedChoice.rows[0]!.id, d.questions.SINGLE_CHOICE])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('DELETE FROM survey_choice_options WHERE id = $1', [d.choices.SINGLE_CHOICE![0]!])).rejects.toMatchObject({ code: '23514' });
  });
  it('fully replaces draft definitions atomically with CAS, ordered bilingual content, and one audit row', async () => {
    const d = await definition({ state: 'DRAFT' });
    const replacement = [{
      ordinal: 0,
      title: { kr: '새 섹션', en: 'New section' },
      items: [
        { ordinal: 0, kind: 'DESCRIPTION', body: { kr: '한국어 설명', en: 'English description' } },
        { ordinal: 1, kind: 'QUESTION', question: { ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '새 질문', en: 'New question' }, helpText: null, required: true, validationRegex: null } },
      ],
    }];
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, replacement as never, 'definition-success')).resolves.toBe('UPDATED');
    expect((await pool.query('SELECT definition_version FROM surveys WHERE id = $1', [d.surveyId])).rows).toEqual([{ definition_version: 2 }]);
    expect((await pool.query('SELECT title_kr, title_en FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows)
      .toEqual([{ title_kr: '새 섹션', title_en: 'New section' }]);
    expect((await pool.query('SELECT body_kr, body_en FROM survey_section_description_items WHERE item_id IN (SELECT id FROM survey_section_items WHERE section_id IN (SELECT id FROM survey_sections WHERE survey_revision_id = $1))', [d.revisionId])).rows)
      .toEqual([{ body_kr: '한국어 설명', body_en: 'English description' }]);
    expect((await pool.query("SELECT count(*) FROM survey_audit_log WHERE survey_id = $1 AND action = 'SURVEY_DEFINITION_REPLACED' AND correlation_id = 'definition-success'", [d.surveyId])).rows[0]!.count).toBe('1');

    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [], 'definition-stale')).resolves.toBe('STALE');
    expect((await pool.query('SELECT definition_version FROM surveys WHERE id = $1', [d.surveyId])).rows[0]!.definition_version).toBe(2);
    expect((await pool.query('SELECT count(*) FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows[0]!.count).toBe('1');
    expect((await pool.query("SELECT count(*) FROM survey_audit_log WHERE survey_id = $1 AND action = 'SURVEY_DEFINITION_REPLACED'", [d.surveyId])).rows[0]!.count).toBe('1');

  });
  it('preserves question and answer identity while round-tripping mixed ordered section items', async () => {
    const d = await definition({ state: 'DRAFT' });
    const section = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows[0]!;
    const questionItem = (await pool.query<{ id: string }>("INSERT INTO survey_section_items (section_id, ordinal, kind, question_id) VALUES ($1, 0, 'QUESTION', $2) RETURNING id", [section.id, d.questions.SHORT_TEXT])).rows[0]!;
    const responseId = await response(d, actorId, 'ordered-identity');
    await pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [responseId, d.questions.SHORT_TEXT, 'retained answer']);

    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      id: section.id, ordinal: 0, title: { kr: '순서', en: 'Order' }, items: [
        { ordinal: 0, kind: 'DESCRIPTION', body: { kr: '설명', en: 'Description' } },
        { id: questionItem.id, ordinal: 1, kind: 'QUESTION', question: { id: d.questions.SHORT_TEXT, ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '바뀐 질문', en: 'Updated question' }, helpText: null, required: false, validationRegex: '^[A-Za-z ]+$', numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] } },
        { ordinal: 2, kind: 'IMAGE_BLOCK', mode: 'SHARED' },
      ],
    }] as never, 'ordered-identity')).resolves.toBe('UPDATED');

    expect((await pool.query('SELECT question_id FROM survey_response_answers WHERE response_id = $1', [responseId])).rows).toEqual([{ question_id: d.questions.SHORT_TEXT }]);
    expect((await pool.query('SELECT id, prompt_en FROM survey_questions WHERE id = $1', [d.questions.SHORT_TEXT])).rows).toEqual([{ id: d.questions.SHORT_TEXT, prompt_en: 'Updated question' }]);
    const detail = await repository.detail(d.surveyId);
    expect(detail!.items.map((item) => [item.kind, item.ordinal])).toEqual([['DESCRIPTION', 0], ['QUESTION', 1], ['IMAGE_BLOCK', 2]]);
    expect(detail!.descriptionItems).toHaveLength(1);
    expect(detail!.imageBlocks).toHaveLength(1);
  });

  it('reconciles retained choice IDs while preserving response-linked choices', async () => {
    const d = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    const section = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows[0]!;
    const item = (await pool.query<{ id: string }>("INSERT INTO survey_section_items (section_id, ordinal, kind, question_id) VALUES ($1, 0, 'QUESTION', $2) RETURNING id", [section.id, d.questions.SINGLE_CHOICE])).rows[0]!;
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      id: section.id, ordinal: 0, title: { kr: '선택', en: 'Choice' }, items: [{
        id: item.id, ordinal: 0, kind: 'QUESTION', question: {
          id: d.questions.SINGLE_CHOICE, ordinal: 0, type: 'SINGLE_CHOICE', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false,
          choices: [
            { id: d.choices.SINGLE_CHOICE![1], ordinal: 0, value: { kr: '둘', en: 'two updated' } },
            { id: d.choices.SINGLE_CHOICE![0], ordinal: 1, value: { kr: '하나', en: 'one updated' } },
            { ordinal: 2, value: { kr: '셋', en: 'three' } },
          ],
        },
      }],
    }], 'choice-reconcile')).resolves.toBe('UPDATED');
    expect((await pool.query('SELECT id, ordinal, value_en FROM survey_choice_options WHERE question_id = $1 ORDER BY ordinal', [d.questions.SINGLE_CHOICE])).rows).toMatchObject([
      { id: d.choices.SINGLE_CHOICE![1], ordinal: 0, value_en: 'two updated' },
      { id: d.choices.SINGLE_CHOICE![0], ordinal: 1, value_en: 'one updated' },
      { ordinal: 2, value_en: 'three' },
    ]);
    const responseId = await response(d, actorId, 'choice-linked');
    await pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [responseId, d.questions.SINGLE_CHOICE, JSON.stringify([d.choices.SINGLE_CHOICE![0]])]);
    await expect(repository.replaceDefinition(d.surveyId, actorId, 2, [{
      id: section.id, ordinal: 0, title: { kr: '선택', en: 'Choice' }, items: [{
        id: item.id, ordinal: 0, kind: 'QUESTION', question: {
          id: d.questions.SINGLE_CHOICE, ordinal: 0, type: 'SINGLE_CHOICE', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false,
          choices: [{ id: d.choices.SINGLE_CHOICE![1], ordinal: 0, value: { kr: '둘', en: 'two' } }],
        },
      }],
    }], 'choice-delete-linked')).resolves.toBe('CHOICE_DELETE_FORBIDDEN');
  });

  it('enforces deferred ordered-item ownership, subtype, and continuity constraints', async () => {
    const left = await definition({ state: 'DRAFT' });
    const right = await definition({ state: 'DRAFT' });
    const leftSection = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [left.revisionId])).rows[0]!;
    await expect(pool.query('BEGIN; INSERT INTO survey_section_items (section_id, ordinal, kind, question_id) VALUES ($1, 0, $2, $3); COMMIT', [leftSection.id, 'QUESTION', right.questions.SHORT_TEXT])).rejects.toBeDefined();
    await expect(pool.query("INSERT INTO survey_section_items (section_id, ordinal, kind) VALUES ($1, 1, 'DESCRIPTION')", [leftSection.id])).rejects.toBeDefined();
  });
  it('rejects a QUESTION item that references a question from another section in the same revision', async () => {
    const d = await definition({ state: 'DRAFT' });
    await pool.query("INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 1, '둘', 'Second')", [d.revisionId]);
    const sections = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1 ORDER BY ordinal', [d.revisionId])).rows;
    await expect(pool.query("BEGIN; INSERT INTO survey_section_items (section_id, ordinal, kind, question_id) VALUES ($1, 0, 'QUESTION', $2); SET CONSTRAINTS ALL IMMEDIATE; COMMIT", [sections[1]!.id, d.questions.SHORT_TEXT])).rejects.toBeDefined();
  });
  it('rejects ordered item and subtype mutations after publication', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '고정', en: 'Frozen' }, items: [
        { ordinal: 0, kind: 'DESCRIPTION', body: { kr: '설명', en: 'Description' } },
        { ordinal: 1, kind: 'QUESTION', question: { id: d.questions.SHORT_TEXT, ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false, validationRegex: null } },
      ],
    }] as never, 'published-ordered-immutability')).resolves.toBe('UPDATED');
    await expect(repository.publish(d.surveyId, actorId, new Date('2026-01-01T00:00:00.000Z'), 'published-ordered-immutability')).resolves.toMatchObject({ id: d.surveyId });
    const item = (await pool.query<{ id: string }>("SELECT id FROM survey_section_items WHERE kind = 'DESCRIPTION' AND section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)", [d.revisionId])).rows[0]!;
    await expect(pool.query('UPDATE survey_section_items SET ordinal = 3 WHERE id = $1', [item.id])).rejects.toMatchObject({ message: 'published_survey_definition_immutable' });
    await expect(pool.query('UPDATE survey_section_description_items SET body_kr = $2 WHERE item_id = $1', [item.id, '변경'])).rejects.toMatchObject({ message: 'published_survey_definition_immutable' });
  });

  it('refuses to publish malformed ordered-image topology', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [
        { ordinal: 0, kind: 'QUESTION', question: { id: d.questions.SHORT_TEXT, ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false, validationRegex: null } },
        { ordinal: 1, kind: 'IMAGE_BLOCK', mode: 'SHARED' },
      ],
    }] as never, 'malformed-publish-topology')).resolves.toBe('UPDATED');
    const block = (await pool.query<{ id: string }>("SELECT id FROM survey_section_items WHERE kind = 'IMAGE_BLOCK' AND section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)", [d.revisionId])).rows[0]!;
    const client = await pool.connect();
    try {
      await client.query('SET session_replication_role = replica');
      await client.query('UPDATE survey_image_blocks SET shared_membership_count = 1 WHERE item_id = $1', [block.id]);
    } finally {
      await client.query('SET session_replication_role = origin');
      client.release();
    }
    await expect(repository.publish(d.surveyId, actorId, new Date('2026-01-01T00:00:00.000Z'), 'malformed-publish-topology')).resolves.toBe('INCOMPLETE_ASSET');
  });
  it('enforces image membership mutation, conversion, locale, cursor, and visibility protocols', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [{ ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'SHARED' }],
    }] as never, 'image-block')).resolves.toBe('UPDATED');
    const blockId = (await pool.query<{ id: string }>("SELECT id FROM survey_section_items WHERE section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)", [d.revisionId])).rows[0]!.id;
    const assets = await Promise.all(['a', 'b'].map(async (suffix) => (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at)
       VALUES ($1, 'COMPLETED', 'test', $2, 'image/png', 1, 1, 1, now()) RETURNING id`,
      [actorId, `ordered-membership-${d.surveyId}-${suffix}`],
    )).rows[0]!.id));
    const add = { expectedDefinitionVersion: 2, clientMutationId: '00000000-0000-4000-8000-000000000001', set: 'SHARED', assetId: assets[0], afterMembershipId: null };
    const [first, replay] = await Promise.all([
      service.addImageMembership(actorId, d.surveyId, blockId, add, 'membership-add'),
      service.addImageMembership(actorId, d.surveyId, blockId, add, 'membership-add-replay'),
    ]);
    if (!first.membership) throw new Error('expected first membership');
    expect(replay).toEqual(first);
    await expect(service.addImageMembership(actorId, d.surveyId, blockId, {
      ...add,
      assetId: assets[1],
    }, 'membership-add-mismatch')).rejects.toThrow('idempotency_mismatch');
    const second = await service.addImageMembership(actorId, d.surveyId, blockId, { ...add, expectedDefinitionVersion: first.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000002', assetId: assets[1], afterMembershipId: first.membership.id }, 'membership-add-second');
    if (!second.membership) throw new Error('expected second membership');
    await expect(service.moveImageMembership(actorId, d.surveyId, blockId, second.membership.id, { expectedDefinitionVersion: first.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000003', afterMembershipId: null }, 'membership-stale')).rejects.toThrow('stale_definition');
    const moved = await service.moveImageMembership(actorId, d.surveyId, blockId, second.membership.id, { expectedDefinitionVersion: second.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000004', afterMembershipId: null }, 'membership-move');
    await expect(service.moveImageMembership(actorId, d.surveyId, blockId, second.membership.id, { expectedDefinitionVersion: second.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000004', afterMembershipId: null }, 'membership-move-replay')).resolves.toEqual(moved);
    const removed = await service.removeImageMembership(actorId, d.surveyId, blockId, first.membership.id, { expectedDefinitionVersion: moved.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000005' }, 'membership-remove');
    await expect(service.removeImageMembership(actorId, d.surveyId, blockId, first.membership.id, { expectedDefinitionVersion: moved.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000005' }, 'membership-remove-replay')).resolves.toEqual(removed);
    expect(removed.membershipCount).toBe(1);

    const localized = await service.changeImageBlockMode(actorId, d.surveyId, blockId, { expectedDefinitionVersion: removed.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000006', mode: 'LOCALIZED' }, 'localized');
    expect(localized.membershipCounts).toEqual({ shared: 0, ko: 1, en: 1 });
    await expect(service.changeImageBlockMode(actorId, d.surveyId, blockId, {
      expectedDefinitionVersion: removed.definitionVersion,
      clientMutationId: '00000000-0000-4000-8000-000000000006',
      mode: 'LOCALIZED',
    }, 'localized-replay')).resolves.toEqual(localized);
    await expect(service.changeImageBlockMode(actorId, d.surveyId, blockId, {
      expectedDefinitionVersion: removed.definitionVersion,
      clientMutationId: '00000000-0000-4000-8000-000000000006',
      mode: 'SHARED',
      retainSet: 'KO',
    }, 'localized-mismatch')).rejects.toThrow('idempotency_mismatch');
    const shared = await service.changeImageBlockMode(actorId, d.surveyId, blockId, { expectedDefinitionVersion: localized.definitionVersion, clientMutationId: '00000000-0000-4000-8000-000000000007', mode: 'SHARED', retainSet: 'KO' }, 'shared');
    expect(shared.membershipCounts).toEqual({ shared: 1, ko: 0, en: 0 });

    await expect(service.imageMembershipPage(undefined, d.surveyId, blockId, { set: 'SHARED' }, 'en')).rejects.toThrow('survey_not_found');
    expect((await service.imageMembershipPage(actorId, d.surveyId, blockId, { set: 'SHARED' }, 'en')).items).toHaveLength(1);
    await pool.query('UPDATE surveys SET only_for_korean_speaker = true WHERE id = $1', [d.surveyId]);
    const page = await service.imageMembershipPage(actorId, d.surveyId, blockId, { set: 'SHARED', limit: 1 }, 'en');
    expect(page.effectiveContentLocale).toBe('ko');
    await expect(service.imageMembershipPage(actorId, d.surveyId, blockId, { set: 'SHARED', cursor: Buffer.from(JSON.stringify({ surveyId: d.surveyId, blockId, set: 'SHARED', definitionVersion: 1, orderKey: 0, id: second.membership.id })).toString('base64url') }, 'ko')).rejects.toThrow('stale_definition');
  });
  it('rejects invalid membership neighbors without mutation and rebalances dense successor sets', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [{ ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'SHARED' }],
    }] as never, 'dense-image-block')).resolves.toBe('UPDATED');
    const blockId = (await pool.query<{ id: string }>('SELECT id FROM survey_section_items WHERE section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)', [d.revisionId])).rows[0]!.id;
    const assets = (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at)
       SELECT $1, 'COMPLETED', 'test', $2 || value, 'image/png', 1, 1, 1, now() FROM generate_series(0, 33) AS value RETURNING id`,
      [actorId, `dense-membership-${d.surveyId}-`],
    )).rows.map((row) => row.id);
    const membershipClient = await pool.connect();
    try {
      await membershipClient.query('BEGIN');
      await membershipClient.query(
        `INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key)
         SELECT $1, 'SHARED', asset_id, order_key FROM unnest($2::uuid[], $3::integer[]) AS membership(asset_id, order_key)`,
        [blockId, assets.slice(0, 33), Array.from({ length: 33 }, (_, index) => index)],
      );
      await membershipClient.query('UPDATE survey_image_blocks SET shared_membership_count = 33 WHERE item_id = $1', [blockId]);
      await membershipClient.query('COMMIT');
    } finally {
      await membershipClient.query('ROLLBACK').catch(() => undefined);
      membershipClient.release();
    }
    const before = await pool.query<{ definition_version: number; count: string }>('SELECT definition_version, (SELECT count(*) FROM survey_image_block_memberships WHERE block_id = $1) AS count FROM surveys WHERE id = $2', [blockId, d.surveyId]);
    await expect(service.addImageMembership(actorId, d.surveyId, blockId, {
      expectedDefinitionVersion: 2,
      clientMutationId: '10000000-0000-4000-8000-000000000001',
      set: 'SHARED',
      assetId: assets[33],
      afterMembershipId: '99999999-9999-4999-8999-999999999999',
    }, 'invalid-neighbor')).rejects.toThrow('invalid_image_membership_neighbor');
    await expect(pool.query('SELECT definition_version, (SELECT count(*) FROM survey_image_block_memberships WHERE block_id = $1) AS count FROM surveys WHERE id = $2', [blockId, d.surveyId])).resolves.toEqual(before);
    await expect(service.addImageMembership(actorId, d.surveyId, blockId, {
      expectedDefinitionVersion: 2,
      clientMutationId: '10000000-0000-4000-8000-000000000002',
      set: 'SHARED',
      assetId: assets[33],
      afterMembershipId: (await pool.query<{ id: string }>('SELECT id FROM survey_image_block_memberships WHERE block_id = $1 ORDER BY order_key, id LIMIT 1', [blockId])).rows[0]!.id,
    }, 'dense-rebalance')).resolves.toMatchObject({ membershipCount: 34 });
    const ordered = await pool.query<{ order_key: number }>('SELECT order_key FROM survey_image_block_memberships WHERE block_id = $1 ORDER BY order_key, id', [blockId]);
    expect(new Set(ordered.rows.map((row) => row.order_key)).size).toBe(34);
  });
  it('requires a definition version and synchronizes Korean-only localized patches', async () => {
    const d = await definition({ state: 'DRAFT' });
    await pool.query('UPDATE surveys SET only_for_korean_speaker = true WHERE id = $1', [d.surveyId]);
    await expect(repository.patch(
      d.surveyId,
      actorId,
      {},
      { titleKr: '한국어 변경', titleEn: 'English change' },
      1,
      'korean-only-mismatch',
    )).resolves.toBe('INVALID_LOCALIZED_CONTENT');
    await expect(repository.patch(
      d.surveyId,
      actorId,
      {},
      { titleKr: '한국어 변경' },
      undefined,
      'korean-only-missing-version',
    )).resolves.toBe('STALE');
    await expect(repository.patch(
      d.surveyId,
      actorId,
      {},
      { titleKr: '한국어 변경' },
      1,
      'korean-only-sync',
    )).resolves.toMatchObject({ id: d.surveyId });
    await expect(pool.query<{ title_kr: string; title_en: string; definition_version: number }>(
      'SELECT revision.title_kr, revision.title_en, survey.definition_version FROM survey_revisions revision JOIN surveys survey ON survey.id = revision.survey_id WHERE revision.id = $1',
      [d.revisionId],
    )).resolves.toMatchObject({ rows: [{ title_kr: '한국어 변경', title_en: '한국어 변경', definition_version: 2 }] });
  });
  it('does not expose a foreign image block through the public membership page', async () => {
    const requested = await definition({ state: 'DRAFT' });
    const foreign = await definition({ state: 'DRAFT' });
    const imageBlockDefinition = [{ ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [
      { ordinal: 0, kind: 'QUESTION', question: { ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false, validationRegex: null } },
      { ordinal: 1, kind: 'IMAGE_BLOCK', mode: 'SHARED' },
    ] }] as never;
    await expect(repository.replaceDefinition(requested.surveyId, actorId, 1, imageBlockDefinition, 'requested-image-block')).resolves.toBe('UPDATED');
    await expect(repository.replaceDefinition(foreign.surveyId, actorId, 1, imageBlockDefinition, 'foreign-image-block')).resolves.toBe('UPDATED');
    const foreignBlockId = (await pool.query<{ id: string }>("SELECT id FROM survey_section_items WHERE kind = 'IMAGE_BLOCK' AND section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)", [foreign.revisionId])).rows[0]!.id;
    const assetId = (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at)
       VALUES ($1, 'COMPLETED', 'test', $2, 'image/png', 1, 1, 1, now()) RETURNING id`,
      [actorId, `foreign-public-page-${foreign.surveyId}`],
    )).rows[0]!.id;
    const membershipClient = await pool.connect();
    try {
      await membershipClient.query('BEGIN');
      await membershipClient.query("INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key) VALUES ($1, 'SHARED', $2, 1024)", [foreignBlockId, assetId]);
      await membershipClient.query('UPDATE survey_image_blocks SET shared_membership_count = 1 WHERE item_id = $1', [foreignBlockId]);
      await membershipClient.query('COMMIT');
    } finally {
      await membershipClient.query('ROLLBACK').catch(() => undefined);
      membershipClient.release();
    }
    await pool.query("UPDATE survey_revisions SET published_at = now() WHERE id = $1", [requested.revisionId]);
    await pool.query("UPDATE surveys SET state = 'OPEN' WHERE id = $1", [requested.surveyId]);

    await expect(service.imageMembershipPage(undefined, requested.surveyId, foreignBlockId, { set: 'SHARED' }, 'en')).rejects.toThrow('survey_not_found');
  });
  it('converts a high-cardinality image block with one set-based membership operation', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [{ ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'SHARED' }],
    }] as never, 'large-mode-conversion')).resolves.toBe('UPDATED');
    const blockId = (await pool.query<{ id: string }>('SELECT id FROM survey_section_items WHERE section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)', [d.revisionId])).rows[0]!.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `WITH assets AS (
          INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at)
          SELECT $1, 'COMPLETED', 'test', $2 || '-' || value, 'image/png', 1, 1, 1, now()
          FROM generate_series(1, 64) AS value
          RETURNING id
        )
        INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key)
        SELECT $3, 'SHARED', id, row_number() OVER () * 1024 FROM assets`,
        [actorId, `large-mode-${d.surveyId}`, blockId],
      );
      await client.query('UPDATE survey_image_blocks SET shared_membership_count = 64 WHERE item_id = $1', [blockId]);
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
    await expect(service.changeImageBlockMode(actorId, d.surveyId, blockId, {
      expectedDefinitionVersion: 2,
      clientMutationId: '00000000-0000-4000-8000-000000000099',
      mode: 'LOCALIZED',
    }, 'large-mode-conversion')).resolves.toMatchObject({ membershipCounts: { shared: 0, ko: 64, en: 64 } });
    expect((await pool.query("SELECT set, count(*) FROM survey_image_block_memberships WHERE block_id = $1 GROUP BY set ORDER BY set", [blockId])).rows)
      .toEqual([{ set: 'KO', count: '64' }, { set: 'EN', count: '64' }]);
  });
  it('claims one stale asset across concurrent workers and retries with a rotated token', async () => {
    const stale = (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets
        (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at, created_at)
       VALUES ($1, 'COMPLETED', 'test', $2, 'image/png', 1, 1, 1, $3, $3)
       RETURNING id`,
      [actorId, `cleanup-${randomUUID()}`, new Date('2026-01-01T00:00:00.000Z')],
    )).rows[0]!;
    const now = new Date('2026-02-01T00:00:00.000Z');
    const [left, right] = await Promise.all([
      repository.claimImageCleanupCandidates(now, 60_000, 1),
      repository.claimImageCleanupCandidates(now, 60_000, 1),
    ]);
    const claim = [...left.claims, ...right.claims];
    expect(claim).toHaveLength(1);
    expect(await repository.beginImageCleanupDeletion(stale.id, claim[0]!.claimToken, now)).toMatchObject({ id: stale.id });
    await expect(repository.completeImageCleanupClaim(stale.id, claim[0]!.claimToken, now, 'provider_unavailable')).resolves.toBe(false);

    const retryAt = new Date(now.getTime() + 2_001);
    const retry = (await repository.claimImageCleanupCandidates(retryAt, 60_000, 1)).claims;
    expect(retry).toHaveLength(1);
    expect(retry[0]!.claimToken).not.toBe(claim[0]!.claimToken);
    await expect(repository.beginImageCleanupDeletion(stale.id, retry[0]!.claimToken, retryAt)).resolves.toMatchObject({ id: stale.id });
    await expect(repository.completeImageCleanupClaim(stale.id, retry[0]!.claimToken, retryAt)).resolves.toBe(true);
    expect((await pool.query('SELECT status, object_deletion_status FROM survey_image_assets WHERE id = $1', [stale.id])).rows)
      .toEqual([{ status: 'DELETED', object_deletion_status: 'DELETED' }]);
  });
  it('skips referenced and not-due cleanup claims before applying the candidate limit', async () => {
    const d = await definition({ state: 'DRAFT' });
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '이미지', en: 'Images' }, items: [{ ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'SHARED' }],
    }] as never, 'cleanup-starvation-block')).resolves.toBe('UPDATED');
    const blockId = (await pool.query<{ id: string }>('SELECT id FROM survey_section_items WHERE section_id = (SELECT id FROM survey_sections WHERE survey_revision_id = $1)', [d.revisionId])).rows[0]!.id;
    const at = new Date('2026-02-01T00:00:00.000Z');
    const insert = async (suffix: string) => (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at, created_at)
       VALUES ($1, 'COMPLETED', 'test', $2, 'image/png', 1, 1, 1, '2026-01-01', '2026-01-01') RETURNING id`,
      [actorId, `cleanup-eligibility-${suffix}-${d.surveyId}`],
    )).rows[0]!.id;
    const referenced = await insert('referenced');
    const deferred = await insert('deferred');
    const due = await insert('due');
    const membershipClient = await pool.connect();
    try {
      await membershipClient.query('BEGIN');
      await membershipClient.query("INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key) VALUES ($1, 'SHARED', $2, 0)", [blockId, referenced]);
      await membershipClient.query('UPDATE survey_image_blocks SET shared_membership_count = 1 WHERE item_id = $1', [blockId]);
      await membershipClient.query('COMMIT');
    } finally {
      await membershipClient.query('ROLLBACK').catch(() => undefined);
      membershipClient.release();
    }
    await pool.query(
      "INSERT INTO survey_image_cleanup_claims (asset_id, claim_token, claimed_at, next_retry_at, attempts) VALUES ($1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $2, $3, 1)",
      [deferred, at, new Date(at.getTime() + 60_000)],
    );
    const first = await repository.claimImageCleanupCandidates(at, 1_000, 1);
    expect(first.claims).toHaveLength(1);
    expect(first.claims[0]!.asset.id).toBe(due);
    await repository.completeImageCleanupClaim(due, first.claims[0]!.claimToken, at, 'retry');
    const dueRetry = await repository.claimImageCleanupCandidates(new Date(at.getTime() + 61_000), 1_000, 2);
    expect(dueRetry.claims.map((claim) => claim.asset.id)).toContain(deferred);
  });

  it('marks exhausted cleanup claims FAILED and reports them without consuming a claim slot', async () => {
    const asset = (await pool.query<{ id: string }>(
      `INSERT INTO survey_image_assets (owner_user_id, status, provider, object_key, content_type, byte_size, width, height, completed_at, created_at)
       VALUES ($1, 'COMPLETED', 'test', $2, 'image/png', 1, 1, 1, '2026-01-01', '2026-01-01') RETURNING id`,
      [actorId, `cleanup-exhausted-${randomUUID()}`],
    )).rows[0]!;
    await pool.query(
      "INSERT INTO survey_image_cleanup_claims (asset_id, claim_token, claimed_at, attempts) VALUES ($1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-01-01', 12)",
      [asset.id],
    );
    const result = await repository.claimImageCleanupCandidates(new Date('2026-02-01T00:00:00.000Z'), 1_000, 1);
    expect(result.exhaustedAssetIds).toEqual([asset.id]);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]!.asset.id).not.toBe(asset.id);
    expect((await pool.query('SELECT object_deletion_status, last_object_deletion_error_code FROM survey_image_assets WHERE id = $1', [asset.id])).rows)
      .toEqual([{ object_deletion_status: 'FAILED', last_object_deletion_error_code: 'attempts_exhausted' }]);
  });

  it('rolls back a failed complete replacement without definition or audit mutation', async () => {
    const d = await definition({ state: 'DRAFT' });
    const before = await pool.query('SELECT count(*) FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId]);
    await expect(repository.replaceDefinition(d.surveyId, actorId, 1, [{
      ordinal: 0, title: { kr: '실패', en: 'Failure' }, items: [{ ordinal: 0, kind: 'QUESTION', question: { ordinal: 0, type: 'INVALID', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false } }],
    }] as never, 'definition-rollback')).rejects.toBeDefined();
    expect((await pool.query('SELECT definition_version FROM surveys WHERE id = $1', [d.surveyId])).rows[0]!.definition_version).toBe(1);
    expect((await pool.query('SELECT count(*) FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows).toEqual(before.rows);
    expect((await pool.query("SELECT count(*) FROM survey_audit_log WHERE correlation_id = 'definition-rollback'")).rows[0]!.count).toBe('0');
  });
  it('serializes complete replacement with publication without exposing a partially replaced definition', async () => {
    const d = await definition({ state: 'DRAFT' });
    const replacement = [{
      ordinal: 0, title: { kr: '경합', en: 'Race' },
      items: [{ ordinal: 0, kind: 'QUESTION', question: { ordinal: 0, type: 'SHORT_TEXT', prompt: { kr: '질문', en: 'Question' }, helpText: null, required: false, validationRegex: null } }],
    }];
    const [replaceResult, publishResult] = await Promise.all([
      repository.replaceDefinition(d.surveyId, actorId, 1, replacement as never, 'definition-publish-race'),
      repository.publish(d.surveyId, actorId, new Date(), 'definition-publish-race'),
    ]);
    expect(['UPDATED', 'IMMUTABLE']).toContain(replaceResult);
    expect(publishResult).toMatchObject({ id: d.surveyId, state: 'OPEN' });
    expect((await pool.query('SELECT state, definition_version FROM surveys WHERE id = $1', [d.surveyId])).rows[0]).toMatchObject({ state: 'OPEN' });
    expect((await pool.query('SELECT count(*) FROM survey_sections WHERE survey_revision_id = $1', [d.revisionId])).rows[0]!.count).toBe('1');
  });
  it('serializes child definition mutations with publication in both lock orders', async () => {
    const childFirst = await definition({ state: 'DRAFT' });
    const childClient = await pool.connect();
    const publisher = await pool.connect();
    try {
      await childClient.query('BEGIN');
      await childClient.query("INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 1, 'before', 'before')", [childFirst.revisionId]);
      await publisher.query('BEGIN');
      await publisher.query("SET LOCAL lock_timeout = '100ms'");
      await expect(publisher.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [childFirst.revisionId])).rejects.toMatchObject({ code: '55P03' });
      await publisher.query('ROLLBACK');
      await childClient.query('COMMIT');
      await expect(repository.publish(childFirst.surveyId, actorId, new Date(), 'child-first-publication')).resolves.toMatchObject({ id: childFirst.surveyId });
    } finally {
      await childClient.query('ROLLBACK').catch(() => undefined);
      await publisher.query('ROLLBACK').catch(() => undefined);
      childClient.release();
      publisher.release();
    }
    expect((await pool.query('SELECT count(*) FROM survey_sections WHERE survey_revision_id = $1', [childFirst.revisionId])).rows[0]!.count).toBe('2');

    const publishFirst = await definition({ state: 'DRAFT' });
    const publicationClient = await pool.connect();
    const mutator = await pool.connect();
    try {
      await publicationClient.query('BEGIN');
      await publicationClient.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [publishFirst.revisionId]);
      await mutator.query('BEGIN');
      await mutator.query("SET LOCAL lock_timeout = '100ms'");
      await expect(mutator.query("INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 1, 'after', 'after')", [publishFirst.revisionId])).rejects.toMatchObject({ code: '55P03' });
      await mutator.query('ROLLBACK');
      await publicationClient.query('COMMIT');
      await expect(pool.query("INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 1, 'after', 'after')", [publishFirst.revisionId])).rejects.toMatchObject({ code: '23514', message: 'published_survey_definition_immutable' });
    } finally {
      await publicationClient.query('ROLLBACK').catch(() => undefined);
      await mutator.query('ROLLBACK').catch(() => undefined);
      publicationClient.release();
      mutator.release();
    }
  });
  it.each(['section', 'question', 'choice'] as const)('serializes %s mutation with publication in both lock orders', async (path) => {
    const childFirst = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    const section = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [childFirst.revisionId])).rows[0]!;
    const mutation = path === 'section'
      ? { sql: "INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en) VALUES ($1, 1, 'locked', 'locked')", values: [childFirst.revisionId] }
      : path === 'question'
        ? { sql: "INSERT INTO survey_questions (section_id, ordinal, type, prompt_kr, prompt_en) VALUES ($1, 1, 'SHORT_TEXT', 'locked', 'locked')", values: [section.id] }
        : { sql: "INSERT INTO survey_choice_options (question_id, ordinal, value_kr, value_en) VALUES ($1, 2, 'locked', 'locked')", values: [childFirst.questions.SINGLE_CHOICE!] };
    const childClient = await pool.connect();
    const publisher = await pool.connect();
    try {
      await childClient.query('BEGIN');
      await childClient.query(mutation.sql, mutation.values);
      await publisher.query('BEGIN');
      await publisher.query("SET LOCAL lock_timeout = '100ms'");
      await expect(publisher.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [childFirst.revisionId])).rejects.toMatchObject({ code: '55P03' });
      await publisher.query('ROLLBACK');
      await childClient.query('COMMIT');
      await expect(repository.publish(childFirst.surveyId, actorId, new Date(), `${path}-first-publication`)).resolves.toMatchObject({ id: childFirst.surveyId });
    } finally {
      await childClient.query('ROLLBACK').catch(() => undefined);
      await publisher.query('ROLLBACK').catch(() => undefined);
      childClient.release();
      publisher.release();
    }

    const publishFirst = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    const publishSection = (await pool.query<{ id: string }>('SELECT id FROM survey_sections WHERE survey_revision_id = $1', [publishFirst.revisionId])).rows[0]!;
    const publishMutation = path === 'section'
      ? { sql: mutation.sql, values: [publishFirst.revisionId] }
      : path === 'question'
        ? { sql: mutation.sql, values: [publishSection.id] }
        : { sql: mutation.sql, values: [publishFirst.questions.SINGLE_CHOICE!] };
    const publicationClient = await pool.connect();
    const mutator = await pool.connect();
    try {
      await publicationClient.query('BEGIN');
      await publicationClient.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [publishFirst.revisionId]);
      await mutator.query('BEGIN');
      await mutator.query("SET LOCAL lock_timeout = '100ms'");
      await expect(mutator.query(publishMutation.sql, publishMutation.values)).rejects.toMatchObject({ code: '55P03' });
      await mutator.query('ROLLBACK');
      await publicationClient.query('COMMIT');
      await expect(pool.query(publishMutation.sql, publishMutation.values)).rejects.toMatchObject({ code: '23514', message: 'published_survey_definition_immutable' });
    } finally {
      await publicationClient.query('ROLLBACK').catch(() => undefined);
      await mutator.query('ROLLBACK').catch(() => undefined);
      publicationClient.release();
      mutator.release();
    }
  });


  it('rejects response revision, question revision, choice, type, and answer-shape mismatches', async () => {
    const first = await definition({ types: ['SINGLE_CHOICE'] });
    const second = await definition({ types: ['SHORT_TEXT'] });
    await expect(pool.query(`INSERT INTO survey_responses (survey_id, survey_revision_id, campus_user_id, state, submitted_at, retention_deadline_at)
      VALUES ($1, $2, $3, 'SUBMITTED', now(), '2099-01-08T00:00:00.000Z')`, [first.surveyId, second.revisionId, actorId])).rejects.toMatchObject({ code: '23514', message: 'survey_response_revision_mismatch' });
    const responseId = await response(first, actorId, 'mismatch');
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [responseId, second.questions.SHORT_TEXT, 'ok text'])).rejects.toMatchObject({ code: '23514', message: 'survey_answer_revision_mismatch' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [responseId, first.questions.SINGLE_CHOICE, 'ok text'])).rejects.toMatchObject({ code: '23514', message: 'survey_choice_answer_invalid' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [responseId, first.questions.SINGLE_CHOICE, JSON.stringify([second.questions.SHORT_TEXT])])).rejects.toMatchObject({ code: '23514', message: 'survey_choice_revision_mismatch' });
  });

  it('accepts and rejects bounded values for all six answer types', async () => {
    const d = await definition({ types: ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE'] });
    const responseId = await response(d, actorId, 'types');
    const valid: Array<[string, string, unknown]> = [
      ['SHORT_TEXT', 'text_value', 'ok short'], ['LONG_TEXT', 'text_value', 'ok long'],
      ['SINGLE_CHOICE', 'choice_option_ids', JSON.stringify([d.choices.SINGLE_CHOICE![0]])],
      ['MULTIPLE_CHOICE', 'choice_option_ids', JSON.stringify(d.choices.MULTIPLE_CHOICE)],
      ['NUMBER', 'number_value', 10], ['DATE', 'date_value', '2026-12-31'],
    ];
    for (const [type, column, value] of valid) await expect(pool.query(`INSERT INTO survey_response_answers (response_id, question_id, ${column}) VALUES ($1, $2, $3)`, [responseId, d.questions[type], value])).resolves.toBeDefined();
    const invalidResponse = await response(d, users[1]!, 'invalid-types');
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [invalidResponse, d.questions.SHORT_TEXT, 'bad123'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [invalidResponse, d.questions.LONG_TEXT, 'bad123'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [invalidResponse, d.questions.SINGLE_CHOICE, JSON.stringify(d.choices.SINGLE_CHOICE)])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [invalidResponse, d.questions.MULTIPLE_CHOICE, JSON.stringify([d.choices.MULTIPLE_CHOICE![0], d.choices.MULTIPLE_CHOICE![0]])])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, number_value) VALUES ($1, $2, $3)', [invalidResponse, d.questions.NUMBER, 11])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, date_value) VALUES ($1, $2, $3)', [invalidResponse, d.questions.DATE, '2027-01-01'])).rejects.toMatchObject({ code: '23514' });
    for (const malformedChoiceIds of [JSON.stringify(['not-a-uuid']), JSON.stringify([123]), JSON.stringify([null]), JSON.stringify([{}])]) {
      await expect(pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [invalidResponse, d.questions.SINGLE_CHOICE, malformedChoiceIds])).rejects.toMatchObject({ code: '23514', message: 'survey_choice_answer_invalid' });
    }
  });

  it('deduplicates campus and encrypted guest identities across survey revisions and enforces PAID_ONLY', async () => {
    const d = await definition({ paid: true, state: 'DRAFT' });
    const revision2 = await pool.query<{ id: string }>(
      `INSERT INTO survey_revisions (survey_id, revision, title_kr, title_en, created_by_user_id)
       VALUES ($1, 2, '새', 'new', $2) RETURNING id`,
      [d.surveyId, actorId],
    );
    await pool.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [d.revisionId]);
    await pool.query("UPDATE surveys SET state = 'OPEN' WHERE id = $1", [d.surveyId]);
    const d2 = { ...d, revisionId: revision2.rows[0]!.id };
    await response(d, actorId, 'campus');
    await expect(response(d, actorId, 'campus-again')).rejects.toMatchObject({ code: '23505' });
    await response(d, null, 'guest');
    await expect(response(d, null, 'guest')).rejects.toMatchObject({ code: '23505' });
    await expect(response(d2, actorId, 'campus-new-revision')).rejects.toMatchObject({ code: '23505' });
    await expect(response(d2, null, 'guest')).rejects.toMatchObject({ code: '23505' });
    const unpaid = await repository.submit(d.surveyId, users[1], null, [], 'paid-only');
    expect(unpaid).toBe('PAID');
    const paid = await repository.submit(d.surveyId, actorId, null, [], 'paid-only-paid');
    expect(paid).not.toBe('PAID');
  });
  it('returns only a non-disclosing sentinel for a duplicate guest phone hash', async () => {
    const d = await definition();
    await response(d, null, 'guest-duplicate');
    await pool.query("UPDATE survey_responses SET state = 'REJECTED', reviewed_at = now(), reviewed_by_user_id = $1, review_reason = 'private' WHERE survey_id = $2", [actorId, d.surveyId]);
    await expect(repository.submit(
      d.surveyId,
      undefined,
      { ciphertext: 'different-ciphertext', hash: phoneHash('guest-duplicate'), version: 'v1', candidates: [{ hash: phoneHash('guest-duplicate'), version: 'v1' }] },
      [{ questionId: d.questions.SHORT_TEXT, textValue: 'unread' }],
      'guest-duplicate',
    )).resolves.toBe('DUPLICATE');
  });

  it('holds cap at N under concurrent N-1/N/N+1 submissions', async () => {
    const d = await definition({ cap: 2 });
    const answers = [{ questionId: d.questions.SHORT_TEXT, textValue: 'ok answer' }];
    const results = await Promise.all(users.slice(0, 3).map((id, index) => repository.submit(d.surveyId, id, null, answers, `cap-${index}`)));
    expect(results.filter((result) => result === 'CAP')).toHaveLength(1);
    expect((await pool.query("SELECT count(*) FROM survey_responses WHERE survey_id = $1 AND state = 'SUBMITTED'", [d.surveyId])).rows[0]!.count).toBe('2');
  });
  it('submits safe literal-hyphen patterns with PostgreSQL-compatible validation', async () => {
    const d = await definition({ validationRegex: '^[A-Z-]+$' });
    await expect(repository.submit(d.surveyId, actorId, null, [{ questionId: d.questions.SHORT_TEXT, textValue: '-' }], 'hyphen-submit')).resolves.toMatchObject({
      response: { campusUserId: actorId },
    });
    await expect(repository.submit(d.surveyId, users[1], null, [{ questionId: d.questions.SHORT_TEXT, textValue: 'lowercase' }], 'hyphen-reject')).resolves.toBe('INVALID');
  });

  it('purges only expired responses after effective closure in bounded SKIP LOCKED batches', async () => {
    const d = await definition();
    await expect(response(d, actorId, 'invalid-pre-close', new Date(Date.now() - 20_000)))
      .rejects.toMatchObject({ code: '23514', message: 'survey_response_retention_before_close' });
    expect(await repository.purgeExpired(1, 'purge-open')).toBe(0);
    await pool.query("UPDATE surveys SET state = 'CLOSED', closes_at = now() - interval '30 seconds' WHERE id = $1", [d.surveyId]);
    const firstExpired = await response(d, actorId, 'first-expired', new Date(Date.now() - 20_000));
    expect(await repository.purgeExpired(1, 'purge-closed')).toBe(1);
    expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [firstExpired])).rows[0]!.count).toBe('0');

    const locked = await response(d, users[1]!, 'locked', new Date(Date.now() - 10_000));
    const expired = await response(d, users[2]!, 'expired', new Date(Date.now() - 5_000));
    const retained = await response(d, users[3]!, 'future', new Date(Date.now() + 60_000));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM survey_responses WHERE id = $1 FOR UPDATE', [locked]);
      expect(await repository.purgeExpired(1, 'purge-bounded')).toBe(1);
      expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [expired])).rows[0]!.count).toBe('0');
      expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [locked])).rows[0]!.count).toBe('1');
    } finally { await client.query('ROLLBACK'); client.release(); }
    expect(await repository.purgeExpired(1, 'purge-locked')).toBe(1);
    expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [retained])).rows[0]!.count).toBe('1');
    const audit = await pool.query<{ changed_field_names: string }>("SELECT changed_field_names FROM survey_audit_log WHERE action = 'SURVEY_RESPONSES_PURGED'");
    expect(audit.rows).toHaveLength(3);
    expect(audit.rows.every((row) => row.changed_field_names === 'responses')).toBe(true);
    expect(JSON.stringify(audit.rows)).not.toMatch(/phone|cipher|hash|answer/i);
    await expect(pool.query("INSERT INTO survey_audit_log (survey_id, action, changed_field_names, correlation_id) VALUES ($1, 'PII_TEST', 'phone=plaintext', 'x')", [d.surveyId])).rejects.toMatchObject({ code: '23514' });
  });
  it('loads only selected choices for high-cardinality CSV export answers', async () => {
    const d = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    const inserted = await pool.query<{ id: string }>(`INSERT INTO survey_choice_options (question_id, ordinal, value_kr, value_en)
      SELECT $1::uuid, ordinal, 'option-' || ordinal, 'option-' || ordinal FROM generate_series(2, 251) AS ordinal RETURNING id`, [d.questions.SINGLE_CHOICE]);
    await pool.query('UPDATE survey_revisions SET published_at = now() WHERE id = $1', [d.revisionId]);
    await pool.query("UPDATE surveys SET state = 'OPEN' WHERE id = $1", [d.surveyId]);
    const responseId = await response(d, actorId, 'high-cardinality-export');
    const selectedChoiceId = inserted.rows.at(-1)!.id;
    await pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [responseId, d.questions.SINGLE_CHOICE, JSON.stringify([selectedChoiceId])]);
    const submitted = await pool.query<{ submitted_at: string }>('SELECT submitted_at::text AS submitted_at FROM survey_responses WHERE id = $1', [responseId]);

    const rows = await repository.exportPage(d.surveyId, 100, undefined, { submittedAt: submitted.rows[0]!.submitted_at, responseId });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.choice_id).toBe(selectedChoiceId);
  });

  it('excludes drafts from review detail, exports, and aggregate revision definitions', async () => {
    const d = await definition({ types: ['SHORT_TEXT'] });
    const eligibleId = await response(d, actorId, 'eligible-export');
    const draftId = await response(d, users[1]!, 'draft-export');
    await pool.query("UPDATE survey_responses SET state = 'DRAFT', submitted_at = NULL WHERE id = $1", [draftId]);

    await expect(service.responseDetail(actorId, d.surveyId, draftId, 'ko')).rejects.toMatchObject({ status: 404 });
    await expect(service.review(actorId, d.surveyId, draftId, { expectedSurveyRevisionId: d.revisionId, state: 'APPROVED' }, 'ko', 'draft-review')).rejects.toMatchObject({ status: 404 });

    const exported = await service.export(actorId, d.surveyId, { format: 'CSV', locale: 'en' }, 'draft-export');
    let csv = '';
    for await (const chunk of exported.chunks) csv += chunk;
    expect(csv).toContain(eligibleId);
    expect(csv).not.toContain(draftId);
    expect(csv.match(new RegExp(eligibleId, 'g'))).toHaveLength(1);
    expect(csv.trim().split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"SUBMITTED"');

    const revision2 = await pool.query<{ id: string }>(`INSERT INTO survey_revisions
      (survey_id, revision, title_kr, title_en, created_by_user_id) VALUES ($1, 2, 'draft revision', 'draft revision', $2) RETURNING id`, [d.surveyId, actorId]);
    const aggregate = await service.aggregate(actorId, d.surveyId, 'en');
    expect(aggregate.revisions.map((revision) => revision.surveyRevisionId)).toEqual([d.revisionId]);
    expect(aggregate.revisions.map((revision) => revision.surveyRevisionId)).not.toContain(revision2.rows[0]!.id);

    const draftOnly = await definition();
    const draftOnlyId = await response(draftOnly, users[2]!, 'draft-only');
    await pool.query("UPDATE survey_responses SET state = 'DRAFT', submitted_at = NULL WHERE id = $1", [draftOnlyId]);
    await expect(service.aggregate(actorId, draftOnly.surveyId, 'ko')).resolves.toMatchObject({ surveySuppressed: true, revisions: [] });
  });
  it('aggregates choice cells with five-person suppression and enforces all matcher pairs, FKs, uniqueness, and delete audit', async () => {
    const d = await definition({ types: ['SINGLE_CHOICE'] });
    for (const [index, userId] of users.slice(0, 4).entries()) {
      const id = await response(d, userId, `aggregate-${index}`);
      await pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [id, d.questions.SINGLE_CHOICE, JSON.stringify([d.choices.SINGLE_CHOICE![index % 2]])]);
    }
    expect((await service.aggregate(actorId, d.surveyId, 'ko')).surveySuppressed).toBe(true);
    const fifth = await response(d, users[4]!, 'aggregate-4');
    await pool.query('INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3)', [fifth, d.questions.SINGLE_CHOICE, JSON.stringify([d.choices.SINGLE_CHOICE![0]])]);
    const aggregate = await service.aggregate(actorId, d.surveyId, 'en');
    expect(aggregate).toEqual({ surveyId: d.surveyId, locale: 'en', surveySuppressed: false, revisions: [{ surveyRevisionId: d.revisionId, revision: 1, suppressed: false, responseCount: 5, questions: [{ questionId: d.questions.SINGLE_CHOICE, prompt: { value: 'SINGLE_CHOICE', translationUnavailable: false }, responseCount: 5, choices: [{ choiceOptionId: d.choices.SINGLE_CHOICE![0], label: { value: 'one', translationUnavailable: false }, count: 3 }, { choiceOptionId: d.choices.SINGLE_CHOICE![1], label: { value: 'two', translationUnavailable: false }, count: 2 }] }] }] });
    const article = await pool.query<{ id: string }>(`INSERT INTO articles (board_id, author_user_id, title_kr, title_en, body_kr, body_en, status, scope, published_at)
      SELECT id, $1, 'survey integration article', 'article', 'body', 'body', 'PUBLISHED', 'ALL', now() FROM boards WHERE code = 'suggestions' RETURNING id`, [actorId]);
    const event = await pool.query<{ id: string }>(`INSERT INTO events (title_kr, title_en, description_kr, description_en, start_at, end_at, location, created_by_user_id, updated_by_user_id)
      VALUES ('행사', 'event', '설명', 'description', now(), now() + interval '1 hour', 'room', $1, $1) RETURNING id`, [actorId]);
    const articleId = article.rows[0]!.id; const eventId = event.rows[0]!.id;
    await expect(pool.query('INSERT INTO content_matchers (created_by_user_id, updated_by_user_id, relation_type) VALUES ($1, $1, $2)', [actorId, 'ANNOUNCEMENT'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO content_matchers (survey_id, created_by_user_id, updated_by_user_id, relation_type) VALUES ($1, $2, $2, $3)', [d.surveyId, actorId, 'SURVEY_PERIOD'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO content_matchers (article_id, event_id, survey_id, created_by_user_id, updated_by_user_id, relation_type) VALUES ($1, $2, $3, $4, $4, $5)', [articleId, eventId, d.surveyId, actorId, 'ANNOUNCEMENT'])).rejects.toMatchObject({ code: '23514' });
    const base = { createdByUserId: actorId, updatedByUserId: actorId, syncMode: 'NONE' as const, synchronizedAt: null };
    const matchers = [];
    for (const relation of [
      { articleId, surveyId: d.surveyId, relationType: 'ANNOUNCEMENT' as const },
      { eventId, surveyId: d.surveyId, relationType: 'SURVEY_PERIOD' as const },
      { articleId, eventId, relationType: 'SCHEDULE' as const },
    ]) {
      const matcher = await repository.matcher({ ...base, ...relation }, 'matcher-create');
      expect(matcher).toMatchObject({ id: expect.any(String), relationType: relation.relationType });
      matchers.push(matcher as { id: string });
    }
    expect(await repository.matcher({ ...base, articleId, surveyId: d.surveyId, relationType: 'ANNOUNCEMENT' }, 'matcher-duplicate')).toBe('DUPLICATE');
    expect(await repository.matcher({ ...base, articleId: '88888888-8888-4888-8888-888888888888', surveyId: d.surveyId, relationType: 'ANNOUNCEMENT' }, 'matcher-article-fk')).toBe('MISSING');
    expect(await repository.matcher({ ...base, articleId, surveyId: '99999999-9999-4999-8999-999999999999', relationType: 'ANNOUNCEMENT' }, 'matcher-survey-fk')).toBe('MISSING');
    expect(await repository.listMatchers({ eventId })).toHaveLength(2);
    const deleted = await repository.deleteMatcher(matchers[0]!.id, actorId, 'matcher-delete');
    expect(deleted?.id).toBe(matchers[0]!.id);
    expect((await pool.query("SELECT count(*) FROM survey_audit_log WHERE action = 'CONTENT_MATCHER_DELETED' AND changed_field_names = 'article_id,event_id,survey_id,relation_type,sync_mode'")).rows[0]!.count).toBe('1');
  });
  it('keeps audit metadata identifier-only and binds response audits to their survey', async () => {
    const first = await definition();
    const second = await definition();
    const responseId = await response(first, actorId, 'audit-owner');
    await expect(pool.query(
      "INSERT INTO survey_audit_log (survey_id, response_id, actor_user_id, action, changed_field_names, correlation_id) VALUES ($1, $2, $3, 'SURVEY_RESPONSE_REVIEWED', 'state,reason', 'audit-1')",
      [first.surveyId, responseId, actorId],
    )).resolves.toBeDefined();
    await expect(pool.query(
      "UPDATE survey_audit_log SET survey_id = $1 WHERE response_id = $2",
      [second.surveyId, responseId],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_audit_response_mismatch' });
    await expect(pool.query(
      "INSERT INTO survey_audit_log (survey_id, action, changed_field_names, correlation_id) VALUES ($1, 'AUDIT_TEST', 'answer_value', 'phone=01012345678')",
      [first.surveyId],
    )).rejects.toMatchObject({ code: '23514' });
    const audit = await pool.query<{ changed_field_names: string; correlation_id: string }>(
      "SELECT changed_field_names, correlation_id FROM survey_audit_log WHERE response_id = $1",
      [responseId],
    );
    expect(audit.rows).toEqual([{ changed_field_names: 'state,reason', correlation_id: 'audit-1' }]);
    expect(JSON.stringify(audit.rows)).not.toMatch(/answer|phone|cipher|hash/i);
  });

  it('requires complete review metadata for every reviewed response state', async () => {
    const d = await definition();
    const approved = await response(d, actorId, 'review-approved');
    const waitlisted = await response(d, users[1]!, 'review-waitlisted');
    const rejected = await response(d, users[2]!, 'review-rejected');
    await expect(pool.query("UPDATE survey_responses SET state = 'APPROVED' WHERE id = $1", [approved])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_responses SET state = 'WAITLISTED', reviewed_at = now() WHERE id = $1", [waitlisted])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_responses SET state = 'REJECTED', reviewed_at = now(), reviewed_by_user_id = $2, review_reason = '   ' WHERE id = $1", [rejected, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_responses SET state = 'REJECTED', reviewed_at = now(), reviewed_by_user_id = $2, review_reason = NULL WHERE id = $1", [rejected, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_responses SET state = 'APPROVED', reviewed_at = now(), reviewed_by_user_id = $2, review_reason = 'not-allowed' WHERE id = $1", [approved, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE survey_responses SET state = 'APPROVED', reviewed_at = now(), reviewed_by_user_id = $2, review_reason = NULL WHERE id = $1", [approved, actorId])).resolves.toBeDefined();
  });

  it('enforces required answers before a submitted response can commit', async () => {
    const d = await definition({ required: true });
    await expect(response(d, actorId, 'required-direct')).rejects.toMatchObject({ code: '23514', message: 'survey_required_answer_missing' });
    await expect(repository.submit(d.surveyId, actorId, null, [], 'required-submit')).resolves.toBe('INVALID');
    await expect(repository.submit(
      d.surveyId,
      actorId,
      null,
      [{ questionId: d.questions.SHORT_TEXT, textValue: 'complete answer' }],
      'required-complete',
    )).resolves.toMatchObject({ response: { campusUserId: actorId } });
  });

  it('refuses publication of incomplete definitions and update-time answer relationship changes', async () => {
    const incomplete = await definition({ state: 'DRAFT', types: ['SINGLE_CHOICE'] });
    await pool.query('DELETE FROM survey_choice_options WHERE question_id = $1', [incomplete.questions.SINGLE_CHOICE]);
    await expect(repository.publish(incomplete.surveyId, actorId, new Date(), 'invalid-topology')).rejects.toMatchObject({
      cause: {
        code: '23514',
        message: 'published_survey_definition_incomplete',
      },
    });

    const first = await definition({ types: ['SHORT_TEXT', 'NUMBER', 'DATE', 'SINGLE_CHOICE'] });
    const second = await definition({ types: ['SINGLE_CHOICE'] });
    const responseId = await response(first, actorId, 'answer-update');
    const answer = await pool.query<{ id: string }>(
      'INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3) RETURNING id',
      [responseId, first.questions.SHORT_TEXT, 'valid text'],
    );
    await expect(pool.query(
      'UPDATE survey_response_answers SET question_id = $2 WHERE id = $1',
      [answer.rows[0]!.id, second.questions.SINGLE_CHOICE],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_answer_revision_mismatch' });
    await expect(pool.query(
      'UPDATE survey_response_answers SET question_id = $2 WHERE id = $1',
      [answer.rows[0]!.id, first.questions.NUMBER],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_number_answer_invalid' });
    const choiceAnswer = await pool.query<{ id: string }>(
      'INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids) VALUES ($1, $2, $3) RETURNING id',
      [responseId, first.questions.SINGLE_CHOICE, JSON.stringify([first.choices.SINGLE_CHOICE![0]])],
    );
    await expect(pool.query(
      'UPDATE survey_response_answers SET choice_option_ids = $2 WHERE id = $1',
      [choiceAnswer.rows[0]!.id, JSON.stringify([second.choices.SINGLE_CHOICE![0]])],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_choice_revision_mismatch' });
    await expect(pool.query(
      'UPDATE survey_response_answers SET choice_option_ids = $2 WHERE id = $1',
      [choiceAnswer.rows[0]!.id, JSON.stringify([first.choices.SINGLE_CHOICE![0], first.choices.SINGLE_CHOICE![0]])],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_choice_answer_invalid' });
    await expect(pool.query(
      'UPDATE survey_response_answers SET choice_option_ids = $2 WHERE id = $1',
      [choiceAnswer.rows[0]!.id, JSON.stringify(['not-a-uuid'])],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_choice_answer_invalid' });
    const numberAnswer = await pool.query<{ id: string }>(
      'INSERT INTO survey_response_answers (response_id, question_id, number_value) VALUES ($1, $2, $3) RETURNING id',
      [responseId, first.questions.NUMBER, 5],
    );
    await expect(pool.query('UPDATE survey_response_answers SET number_value = 11 WHERE id = $1', [numberAnswer.rows[0]!.id])).rejects.toMatchObject({ code: '23514', message: 'survey_number_answer_invalid' });
    const dateAnswer = await pool.query<{ id: string }>(
      'INSERT INTO survey_response_answers (response_id, question_id, date_value) VALUES ($1, $2, $3) RETURNING id',
      [responseId, first.questions.DATE, '2026-06-01'],
    );
    await expect(pool.query("UPDATE survey_response_answers SET date_value = '2027-01-01' WHERE id = $1", [dateAnswer.rows[0]!.id])).rejects.toMatchObject({ code: '23514', message: 'survey_date_answer_invalid' });
    await expect(pool.query("UPDATE survey_response_answers SET text_value = 'bad123' WHERE id = $1", [answer.rows[0]!.id])).rejects.toMatchObject({ code: '23514', message: 'survey_text_answer_invalid' });
  });
  it('keeps answer and active guest-alias parents immutable, guards close extensions, and permits phone-optional anonymous guests', async () => {
    const d = await definition();
    const firstResponseId = await response(d, actorId, 'immutable-answer-first');
    const secondResponseId = await response(d, users[1]!, 'immutable-answer-second');
    const answer = await pool.query<{ id: string }>(
      'INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3) RETURNING id',
      [firstResponseId, d.questions.SHORT_TEXT, 'owned answer'],
    );
    await expect(pool.query(
      'UPDATE survey_response_answers SET response_id = $2 WHERE id = $1',
      [answer.rows[0]!.id, secondResponseId],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_answer_response_immutable' });

    const firstGuestId = await response(d, null, 'immutable-alias-first');
    const secondGuestId = await response(d, null, 'immutable-alias-second');
    await expect(pool.query(
      'UPDATE survey_guest_identity_hashes SET response_id = $2 WHERE response_id = $1',
      [firstGuestId, secondGuestId],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_response_active_identity_alias_immutable' });

    await expect(pool.query(
      "UPDATE surveys SET closes_at = '2099-01-09T00:00:00.000Z' WHERE id = $1",
      [d.surveyId],
    )).rejects.toMatchObject({ code: '23514', message: 'survey_close_exceeds_retention_deadline' });

    const anonymous = await definition();
    await pool.query('UPDATE surveys SET phone_required = false WHERE id = $1', [anonymous.surveyId]);
    await expect(repository.submit(
      anonymous.surveyId,
      undefined,
      null,
      [{ questionId: anonymous.questions.SHORT_TEXT, textValue: 'anonymous answer' }],
      'anonymous-submit',
    )).resolves.toMatchObject({
      response: {
        campusUserId: null,
        guestPhoneHash: null,
        guestPhoneHashVersion: null,
      },
    });
    const exportResult = await repository.export(anonymous.surveyId, actorId, 'future-export');
    expect(exportResult).toMatchObject({ export: { surveyId: anonymous.surveyId }, upperBoundary: expect.any(Object) });
    expect(exportResult && exportResult !== 'INVALID' && exportResult.export.retentionDeadlineAt.toISOString()).toBe('2099-01-08T00:00:00.000Z');
    const elapsed = await definition();
    await pool.query("UPDATE surveys SET state = 'CLOSED', closes_at = now() - interval '31 days' WHERE id = $1", [elapsed.surveyId]);
    await expect(repository.export(elapsed.surveyId, actorId, 'elapsed-export')).resolves.toBe('INVALID');
  });

  it('purges expired answer children only after closure and leaves pre-close data intact', async () => {
    const d = await definition();
    const retainedId = await response(d, actorId, 'retained-before-close');
    await pool.query(
      'INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)',
      [retainedId, d.questions.SHORT_TEXT, 'retained before close'],
    );
    expect(await repository.purgeExpired(10, 'purge-before-close')).toBe(0);
    await pool.query("UPDATE surveys SET state = 'CLOSED', closes_at = now() - interval '30 seconds' WHERE id = $1", [d.surveyId]);
    const expiredId = await response(d, users[1]!, 'purge-children', new Date(Date.now() - 10_000));
    await pool.query(
      'INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)',
      [expiredId, d.questions.SHORT_TEXT, 'expired after close'],
    );
    expect(await repository.purgeExpired(10, 'purge-after-close')).toBe(1);
    expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [expiredId])).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM survey_response_answers WHERE response_id = $1', [expiredId])).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM survey_responses WHERE id = $1', [retainedId])).rows[0]!.count).toBe('1');
  });

  it('deduplicates active and prior guest HMAC candidates without returning stored answers', async () => {
    const d = await definition({ cap: 1 });
    const priorHash = 'a'.repeat(43);
    const activeHash = 'b'.repeat(43);
    await expect(repository.submit(
      d.surveyId,
      undefined,
      { ciphertext: 'cipher-prior', hash: priorHash, version: 'v1', candidates: [{ hash: priorHash, version: 'v1' }] },
      [{ questionId: d.questions.SHORT_TEXT, textValue: 'stored answer' }],
      'hmac-prior',
    )).resolves.toMatchObject({ response: { guestPhoneHash: priorHash } });
    await expect(repository.submit(
      d.surveyId,
      undefined,
      { ciphertext: 'cipher-active', hash: activeHash, version: 'v2', candidates: [{ hash: activeHash, version: 'v2' }, { hash: priorHash, version: 'v1' }] },
      [{ questionId: d.questions.SHORT_TEXT, textValue: 'new answer' }],
      'hmac-rotation',
    )).resolves.toBe('DUPLICATE');
  });
  it('keeps revision aggregate provenance and CSV export long-form, safe, and free of guest identity data', async () => {
    const first = await definition({ types: ['LONG_TEXT', 'MULTIPLE_CHOICE'] });
    const revision = await pool.query<{ id: string }>(
      `INSERT INTO survey_revisions (survey_id, revision, title_kr, title_en, created_by_user_id)
       VALUES ($1, 2, 'second', 'second', $2) RETURNING id`,
      [first.surveyId, actorId],
    );
    const section = await pool.query<{ id: string }>(
      `INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en)
       VALUES ($1, 0, 'second', 'second') RETURNING id`,
      [revision.rows[0]!.id],
    );
    const question = await pool.query<{ id: string }>(
      `INSERT INTO survey_questions (section_id, ordinal, type, prompt_kr, prompt_en)
       VALUES ($1, 0, 'LONG_TEXT', '=question', '=question') RETURNING id`,
      [section.rows[0]!.id],
    );
    const second = { surveyId: first.surveyId, revisionId: revision.rows[0]!.id, questions: { LONG_TEXT: question.rows[0]!.id }, choices: {} };
    const answerSuffixes = ['zero', 'one', 'two', 'three', 'four'];
    const zeroAnswerResponse = await response(first, null, 'guest-secret-empty');
    for (const index of [0, 1, 2, 3, 4]) {
      const firstResponse = await response(first, null, `guest-secret-${index}`);
      await pool.query(
        'INSERT INTO survey_response_answers (response_id, question_id, text_value, choice_option_ids) VALUES ($1, $2, $3, NULL), ($1, $4, NULL, $5)',
        [firstResponse, first.questions.LONG_TEXT, `long answer ${answerSuffixes[index]}`, first.questions.MULTIPLE_CHOICE, JSON.stringify(first.choices.MULTIPLE_CHOICE)],
      );
      const secondResponse = await response(second, users[index]!, `second-${index}`);
      await pool.query('INSERT INTO survey_response_answers (response_id, question_id, text_value) VALUES ($1, $2, $3)', [secondResponse, second.questions.LONG_TEXT, '+formula']);
    }

    const aggregate = await service.aggregate(actorId, first.surveyId, 'en');
    expect(aggregate).toMatchObject({
      surveySuppressed: false,
      revisions: [
        { surveyRevisionId: first.revisionId, revision: 1, suppressed: false, responseCount: 6 },
        { surveyRevisionId: second.revisionId, revision: 2, suppressed: false, responseCount: 5, questions: [{ prompt: { value: '=question', translationUnavailable: false }, responseCount: 5 }] },
      ],
    });

    const exported = await service.export(actorId, first.surveyId, { format: 'CSV', locale: 'en' }, 'long-form-export');
    const chunks: string[] = [];
    for await (const chunk of exported.chunks) chunks.push(chunk);
    const csv = chunks.join('');
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(22);
    const sentinel = lines.find((line) => line.includes(zeroAnswerResponse));
    expect(sentinel).toBeDefined();
    const sentinelFields = sentinel!.split(',');
    expect(sentinelFields).toHaveLength(14);
    expect(sentinelFields.slice(0, 5)).toEqual([`"${first.surveyId}"`, `"${first.revisionId}"`, '"1"', `"${zeroAnswerResponse}"`, '"SUBMITTED"']);
    expect(sentinelFields.slice(6)).toEqual(Array(8).fill('""'));
    expect(csv).toContain(`"'=question"`);
    expect(csv).toContain(`"'+formula"`);
    expect(csv).not.toContain('cipher-guest-secret-0');
    expect(csv).not.toContain('cipher-guest-secret-empty');
    expect(csv).not.toContain(phoneHash('guest-secret-0'));
    expect(csv).not.toContain(phoneHash('guest-secret-empty'));
    for (const field of ['guest_phone', 'guestPhone', 'guestPhoneCiphertext', 'guestPhoneHash']) expect(csv).not.toContain(field);

    await pool.query('BEGIN');
    try {
      await pool.query('SET LOCAL enable_seqscan = off');
      const plan = await pool.query<{ 'QUERY PLAN': unknown }>(
        `EXPLAIN (FORMAT JSON) SELECT id FROM survey_responses
         WHERE survey_id = $1 AND state = 'SUBMITTED' ORDER BY submitted_at DESC, id DESC`,
        [first.surveyId],
      );
      expect(JSON.stringify(plan.rows[0]!['QUERY PLAN'])).toContain('survey_responses_review_queue_idx');
    } finally {
      await pool.query('ROLLBACK');
    }
  });
});
