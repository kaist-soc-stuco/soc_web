import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FaqsRepository } from '../src/features/faqs/faqs.repository';
import { FaqsService } from '../src/features/faqs/faqs.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const migrations = resolve(__dirname, '../drizzle');
const actorId = '11111111-1111-4111-8111-111111111111';
const clock = new Date('2026-07-27T12:00:00.000Z');
let pool: Pool;
let service: FaqsService;

/** Uses caller-provided TEST_DATABASE_URL; this suite never starts containers or Docker. */
describe.skipIf(!databaseUrl)('FAQ PostgreSQL protocol', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: migrations });
    const repository = new FaqsRepository(drizzle(pool) as never);
    service = new FaqsService(repository, { hasPermission: async () => true } as never, { now: () => clock } as never);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE permission_audit_log, faqs, faq_topics, users CASCADE');
    await pool.query('INSERT INTO users (id, sso_user_id, sso_subject) VALUES ($1, $2, $3)', [actorId, 'faq-test-user', 'faq-test-subject']);
  });
  afterAll(async () => { await pool?.end(); });

  it('enforces topic nonempty and duplicate display-order constraints', async () => {
    const first = await service.createTopic(actorId, { titleKr: '첫째', titleEn: 'First', displayOrder: 0 });
    await expect(service.createTopic(actorId, { titleKr: '둘째', titleEn: 'Second', displayOrder: 0 })).rejects.toMatchObject({ response: { message: 'faq_order_conflict' } });
    await service.createFaq(actorId, { topicId: first.id, questionKr: '질문', questionEn: 'Question', answerKr: '답변', answerEn: 'Answer', displayOrder: 0, status: 'PUBLISHED' });
    await expect(service.deleteTopic(actorId, first.id)).rejects.toMatchObject({ response: { message: 'faq_topic_not_empty' } });
  });

  it('reorders concurrent requests atomically into a contiguous unique sequence', async () => {
    const topics = await Promise.all(['A', 'B', 'C'].map((titleEn, displayOrder) => service.createTopic(actorId, { titleKr: titleEn, titleEn, displayOrder })));
    const attempts = await Promise.allSettled([
      service.reorderTopic(actorId, topics[0]!.id, 2),
      service.reorderTopic(actorId, topics[2]!.id, 0),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(2);
    const rows = await pool.query<{ id: string; display_order: number }>('SELECT id, display_order FROM faq_topics ORDER BY display_order, id');
    expect(rows.rows.map((row) => row.display_order)).toEqual([0, 1, 2]);
    expect(rows.rows.map((row) => row.id)).toEqual([topics[2]!.id, topics[1]!.id, topics[0]!.id]);
    expect(new Set(rows.rows.map((row) => row.display_order)).size).toBe(3);
    const reorderAudit = await pool.query<{ record_id: string }>(
      "SELECT record_id FROM permission_audit_log WHERE action = 'FAQ_TOPIC_REORDERED'",
    );
    expect(new Set(reorderAudit.rows.map((entry) => entry.record_id)))
      .toEqual(new Set(topics.map((topic) => topic.id)));

    const [createdDuringReorder, reordered] = await Promise.all([
      service.createTopic(actorId, { titleKr: 'D', titleEn: 'D', displayOrder: 3 }),
      service.reorderTopic(actorId, topics[2]!.id, 2),
    ]);
    expect(createdDuringReorder.displayOrder).toBe(3);
    expect(reordered.displayOrder).toBe(2);
    const afterCreateRace = await pool.query<{ display_order: number }>(
      'SELECT display_order FROM faq_topics ORDER BY display_order',
    );
    expect(afterCreateRace.rows.map((row) => row.display_order)).toEqual([0, 1, 2, 3]);
  });

  it('reorders sparse high integer orders without temporary overflow', async () => {
    const first = await service.createTopic(actorId, { titleKr: '첫째', titleEn: 'First', displayOrder: 100 });
    const high = await service.createTopic(actorId, { titleKr: '둘째', titleEn: 'Second', displayOrder: 2_147_483_647 });
    await service.reorderTopic(actorId, high.id, 0);
    const rows = await pool.query<{ id: string; display_order: number }>(
      'SELECT id, display_order FROM faq_topics ORDER BY display_order',
    );
    expect(rows.rows).toEqual([
      { id: high.id, display_order: 0 },
      { id: first.id, display_order: 1 },
    ]);
    const reorderAudit = await pool.query<{ record_id: string }>(
      "SELECT record_id FROM permission_audit_log WHERE action = 'FAQ_TOPIC_REORDERED'",
    );
    expect(new Set(reorderAudit.rows.map((entry) => entry.record_id))).toEqual(new Set([first.id, high.id]));
  });

  it('persists injected timestamps and actor attribution while audit records contain field names, never FAQ content', async () => {
    const createdTopic = await service.createTopic(actorId, { titleKr: '주제', titleEn: 'Topic', displayOrder: 0 });
    const createdFaq = await service.createFaq(actorId, { topicId: createdTopic.id, questionKr: '비밀 질문', questionEn: 'Secret question', answerKr: '비밀 답변', answerEn: 'Secret answer', displayOrder: 0, status: 'DRAFT' });
    await service.patchFaq(actorId, createdFaq.id, { status: 'PUBLISHED' });
    const persisted = await pool.query<{ updated_by_user_id: string; updated_at: Date }>('SELECT updated_by_user_id, updated_at FROM faqs WHERE id = $1', [createdFaq.id]);
    expect(persisted.rows[0]).toMatchObject({ updated_by_user_id: actorId });
    expect(persisted.rows[0]!.updated_at.toISOString()).toBe(clock.toISOString());
    const audit = await pool.query<{ changed_field_names: string; reason_code: string | null }>('SELECT changed_field_names, reason_code FROM permission_audit_log WHERE record_id = $1', [createdFaq.id]);
    expect(audit.rows).not.toHaveLength(0);
    for (const entry of audit.rows) {
      expect(entry.changed_field_names).not.toContain('비밀');
      expect(entry.changed_field_names).not.toMatch(/before|after|value/i);
      expect(entry.reason_code).toBe('FAQ_ADMIN');
    }
  });

  it('rolls back FAQ creation when its audit insert fails', async () => {
    const createdTopic = await service.createTopic(actorId, { titleKr: '주제', titleEn: 'Topic', displayOrder: 0 });
    await pool.query("CREATE OR REPLACE FUNCTION reject_faq_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'FAQ_CREATED' THEN RAISE EXCEPTION 'reject FAQ audit'; END IF; RETURN NEW; END; $$");
    await pool.query('CREATE TRIGGER reject_faq_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_faq_audit()');
    try {
      await expect(service.createFaq(actorId, {
        topicId: createdTopic.id,
        questionKr: '질문',
        questionEn: 'Question',
        answerKr: '답변',
        answerEn: 'Answer',
        displayOrder: 0,
        status: 'PUBLISHED',
      })).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM faqs')).rows[0]!.count).toBe('0');
    } finally {
      await pool.query('DROP TRIGGER reject_faq_audit_trigger ON permission_audit_log; DROP FUNCTION reject_faq_audit()');
    }
  });

  it('rolls back every remaining FAQ/topic mutation when audit insertion fails', async () => {
    const first = await service.createTopic(actorId, { titleKr: '첫째', titleEn: 'First', displayOrder: 0 });
    const second = await service.createTopic(actorId, { titleKr: '둘째', titleEn: 'Second', displayOrder: 1 });
    const faq = await service.createFaq(actorId, {
      topicId: first.id,
      questionKr: '질문',
      questionEn: 'Question',
      answerKr: '답변',
      answerEn: 'Answer',
      displayOrder: 0,
      status: 'DRAFT',
    });

    const rejectAudit = async (
      action: 'FAQ_TOPIC_CREATED' | 'FAQ_TOPIC_UPDATED' | 'FAQ_TOPIC_REORDERED' | 'FAQ_UPDATED' | 'FAQ_DELETED' | 'FAQ_TOPIC_DELETED',
      operation: () => Promise<unknown>,
    ) => {
      await pool.query(`CREATE OR REPLACE FUNCTION reject_selected_faq_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = '${action}' THEN RAISE EXCEPTION 'reject selected FAQ audit'; END IF; RETURN NEW; END; $$`);
      await pool.query('CREATE TRIGGER reject_selected_faq_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_selected_faq_audit()');
      try {
        await expect(operation()).rejects.toThrow();
      } finally {
        await pool.query('DROP TRIGGER reject_selected_faq_audit_trigger ON permission_audit_log; DROP FUNCTION reject_selected_faq_audit()');
      }
    };

    await rejectAudit('FAQ_TOPIC_CREATED', () =>
      service.createTopic(actorId, { titleKr: '셋째', titleEn: 'Third', displayOrder: 2 }));
    expect((await pool.query('SELECT count(*) FROM faq_topics')).rows[0]!.count).toBe('2');

    await rejectAudit('FAQ_TOPIC_UPDATED', () =>
      service.patchTopic(actorId, first.id, { titleKr: '변경 실패' }));
    expect((await pool.query<{ title_kr: string }>('SELECT title_kr FROM faq_topics WHERE id = $1', [first.id])).rows[0]!.title_kr).toBe('첫째');

    await rejectAudit('FAQ_TOPIC_REORDERED', () =>
      service.reorderTopic(actorId, second.id, 0));
    expect((await pool.query<{ id: string }>('SELECT id FROM faq_topics ORDER BY display_order')).rows.map((row) => row.id))
      .toEqual([first.id, second.id]);

    await rejectAudit('FAQ_UPDATED', () =>
      service.patchFaq(actorId, faq.id, { status: 'PUBLISHED' }));
    expect((await pool.query<{ status: string }>('SELECT status FROM faqs WHERE id = $1', [faq.id])).rows[0]!.status).toBe('DRAFT');

    await rejectAudit('FAQ_DELETED', () =>
      service.deleteFaq(actorId, faq.id));
    expect((await pool.query('SELECT count(*) FROM faqs WHERE id = $1', [faq.id])).rows[0]!.count).toBe('1');

    await rejectAudit('FAQ_TOPIC_DELETED', () =>
      service.deleteTopic(actorId, second.id));
    expect((await pool.query('SELECT count(*) FROM faq_topics WHERE id = $1', [second.id])).rows[0]!.count).toBe('1');
  });
});
