import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EventsRepository } from '../src/features/events/events.repository';
import { EventsService } from '../src/features/events/events.service';

import { migrateWithCompletedPiiBackfill } from './utils/staged-migrations';
const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
const run = databaseUrl ? describe : describe.skip;
const managerId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const start = Date.parse('2026-03-01T00:00:00.000Z');
const event = { titleKr: '한국어', titleEn: 'English', descriptionKr: '설명', descriptionEn: 'Description', startAtMs: start, endAtMs: start + 3_600_000, allDay: false, allDayStartDate: null, allDayEndDate: null, location: 'Room', visibility: 'PUBLIC' as const };

run('events PostgreSQL protocol (external TEST_DATABASE_URL)', () => {
  let pool: Pool; let service: EventsService; let repository: EventsRepository;
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrateWithCompletedPiiBackfill(pool);
    repository = new EventsRepository(drizzle(pool) as never);
    service = new EventsService(
      repository,
      {
        hasPermission: async (actorId: string, key: string) =>
          actorId === managerId && (key === 'EVENT_MANAGE' || key === 'COMMITTEE_MEMBER'),
      } as never,
      { now: () => new Date('2026-04-01T01:02:03.000Z') } as never,
    );
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE events, permission_audit_log, permission_grants, permission_definitions, users CASCADE');
    for (const id of [managerId, userId]) await pool.query('INSERT INTO users (id, sso_user_id, permission) VALUES ($1, $2, 0)', [id, `sso-${id}`]);
    const definition = await pool.query<{ id: string }>("INSERT INTO permission_definitions (key, description) VALUES ('EVENT_MANAGE', 'events') RETURNING id");
    await pool.query('INSERT INTO permission_grants (user_id, permission_definition_id, scope, granted_by_user_id) VALUES ($1, $2, \'GLOBAL\', $1)', [managerId, definition.rows[0]!.id]);
  });
  afterAll(async () => { await pool?.end(); });

  it('lists only [fromMs,toMs) overlaps in order with a 200-row limit and visibility boundaries', async () => {
    const created = await Promise.all(Array.from({ length: 201 }, (_, index) => service.create(managerId, { ...event, titleKr: `제목${index}`, titleEn: `Title${index}`, startAtMs: start + index * 1_000, endAtMs: start + (index + 1) * 1_000, visibility: index === 0 ? 'AUTHENTICATED' : index === 1 ? 'COMMITTEE' : 'PUBLIC' })));
    const publicRows = await service.list(undefined, { fromMs: start, toMs: start + 300_000 });
    expect(publicRows.items).toHaveLength(199);
    expect(publicRows.items.every((item) => item.visibility === 'PUBLIC' && !Object.hasOwn(item, 'surveyId'))).toBe(true);
    const authenticated = await service.list(userId, { fromMs: start, toMs: start + 300_000, locale: 'en' });
    expect(authenticated.items).toHaveLength(200);
    expect(authenticated.items[0]!.title.value).toBe('Title0');
    expect(authenticated.items.every((item, index, items) =>
      index === 0 || items[index - 1]!.startAtMs <= item.startAtMs)).toBe(true);
    const committee = await service.list(managerId, { fromMs: start, toMs: start + 300_000 });
    expect(committee.items).toHaveLength(200);
    expect((await service.list(undefined, { fromMs: start + 1_000, toMs: start + 2_000 })).items.map((item) => item.id)).not.toContain(created[0]!.id);
  });

  it('writes bilingual KST all-day events with Clock timestamps and one minimized audit row per mutation', async () => {
    const created = await service.create(managerId, { ...event, allDay: true, allDayStartDate: '2026-03-01', allDayEndDate: '2026-03-03', startAtMs: Date.parse('2026-03-01T00:00:00+09:00'), endAtMs: Date.parse('2026-03-03T00:00:00+09:00'), visibility: 'COMMITTEE' });
    expect(created).toMatchObject({ allDay: true, allDayStartDate: '2026-03-01', allDayEndDate: '2026-03-03', updatedAt: '2026-04-01T01:02:03.000Z' });
    await service.patch(managerId, created.id, { location: 'New room' });
    await service.delete(managerId, created.id);
    const audit = await pool.query<{ action: string; changed_field_names: string }>('SELECT action, changed_field_names FROM permission_audit_log ORDER BY occurred_at');
    expect(audit.rows).toEqual([{ action: 'EVENT_CREATED', changed_field_names: 'title,description,time,allDay,location,visibility' }, { action: 'EVENT_UPDATED', changed_field_names: 'location' }, { action: 'EVENT_DELETED', changed_field_names: 'record' }]);
    expect(JSON.stringify(audit.rows)).not.toMatch(/한국어|English|설명|Description|New room/);
  });

  it('serializes concurrent disjoint patches without losing either change', async () => {
    const created = await service.create(managerId, event);
    await Promise.all([
      service.patch(managerId, created.id, { titleKr: '동시 수정 제목' }),
      service.patch(managerId, created.id, { location: 'Concurrent room' }),
    ]);
    const persisted = await pool.query<{ title_kr: string; location: string }>(
      'SELECT title_kr, location FROM events WHERE id = $1',
      [created.id],
    );
    expect(persisted.rows[0]).toEqual({ title_kr: '동시 수정 제목', location: 'Concurrent room' });
  });

  it('rolls back patch and delete mutations when their audit insert fails', async () => {
    const created = await service.create(managerId, event);
    await pool.query("CREATE OR REPLACE FUNCTION reject_event_mutation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('EVENT_UPDATED', 'EVENT_DELETED') THEN RAISE EXCEPTION 'reject event mutation audit'; END IF; RETURN NEW; END; $$");
    await pool.query('CREATE TRIGGER reject_event_mutation_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_event_mutation_audit()');
    try {
      await expect(service.patch(managerId, created.id, { location: 'Should roll back' })).rejects.toThrow();
      expect((await pool.query<{ location: string }>('SELECT location FROM events WHERE id = $1', [created.id])).rows[0]!.location).toBe('Room');
      await expect(service.delete(managerId, created.id)).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM events WHERE id = $1', [created.id])).rows[0]!.count).toBe('1');
    } finally {
      await pool.query('DROP TRIGGER reject_event_mutation_audit_trigger ON permission_audit_log; DROP FUNCTION reject_event_mutation_audit()');
    }
  });

  it('rolls back the event when its audit insert fails', async () => {
    await pool.query("CREATE OR REPLACE FUNCTION reject_event_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EVENT_CREATED' THEN RAISE EXCEPTION 'reject event audit'; END IF; RETURN NEW; END; $$");
    await pool.query('CREATE TRIGGER reject_event_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_event_audit()');
    await expect(service.create(managerId, event)).rejects.toThrow();
    expect((await pool.query('SELECT count(*) FROM events')).rows[0]!.count).toBe('0');
    await pool.query('DROP TRIGGER reject_event_audit_trigger ON permission_audit_log; DROP FUNCTION reject_event_audit()');
  });
  it('resolves visible event matchers by effective timed state and keeps list provenance unqueried', async () => {
    const created = await service.create(managerId, event);
    const surveyIds: Record<string, string> = {};
    const now = Date.now();
    const candidates = [
      { name: 'DRAFT', state: 'DRAFT', opensAt: null, closesAt: null },
      { name: 'ARCHIVED', state: 'ARCHIVED', opensAt: null, closesAt: null },
      { name: 'CLOSED', state: 'OPEN', opensAt: null, closesAt: new Date(now - 86_400_000) },
      { name: 'SCHEDULED', state: 'SCHEDULED', opensAt: new Date(now + 86_400_000), closesAt: new Date(now + 172_800_000) },
      { name: 'OPEN', state: 'SCHEDULED', opensAt: new Date(now - 86_400_000), closesAt: new Date(now + 86_400_000) },
    ] as const;
    for (const candidate of candidates) {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO surveys (state, response_retention_days, created_by_user_id, updated_by_user_id)
         VALUES ('DRAFT', 365, $1, $1) RETURNING id`,
        [managerId],
      );
      const surveyId = inserted.rows[0]!.id;
      await pool.query(
        `INSERT INTO survey_revisions (survey_id, revision, title_kr, title_en, created_by_user_id)
         VALUES ($1, 1, $2, $2, $3)`,
        [surveyId, candidate.name, managerId],
      );
      await pool.query(
        `WITH inserted_section AS (
           INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en)
           SELECT id, 0, '기본', 'Basic' FROM survey_revisions WHERE survey_id = $1
           RETURNING id
         )
         INSERT INTO survey_questions (section_id, ordinal, type, prompt_kr, prompt_en)
         SELECT id, 0, 'SHORT_TEXT', '질문', 'Question' FROM inserted_section`,
        [surveyId],
      );
      if (candidate.state !== 'DRAFT') {
        await pool.query('UPDATE survey_revisions SET published_at = now() WHERE survey_id = $1', [surveyId]);
        await pool.query(
          'UPDATE surveys SET state = $2, opens_at = $3, closes_at = $4 WHERE id = $1',
          [surveyId, candidate.state, candidate.opensAt, candidate.closesAt],
        );
      }
      await pool.query(
        `INSERT INTO content_matchers (event_id, survey_id, created_by_user_id)
         VALUES ($1, $2, $3)`,
        [created.id, surveyId, managerId],
      );
      surveyIds[candidate.name] = surveyId;
    }

    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({ surveyId: surveyIds.OPEN });
    await pool.query('DELETE FROM content_matchers WHERE event_id = $1 AND survey_id = $2', [created.id, surveyIds.OPEN]);
    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({ surveyId: surveyIds.SCHEDULED });
    await pool.query('DELETE FROM content_matchers WHERE event_id = $1 AND survey_id = $2', [created.id, surveyIds.SCHEDULED]);
    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({ surveyId: surveyIds.CLOSED });
    await pool.query('DELETE FROM content_matchers WHERE event_id = $1', [created.id]);
    await expect(service.get(undefined, created.id, 'ko')).resolves.toEqual(expect.objectContaining({ surveyId: null }));
  });
  it('keeps manually closed matchers terminal behind competing effective open and scheduled matchers', async () => {
    const created = await service.create(managerId, event);
    const now = Date.now();
    const addMatcher = async (state: 'OPEN' | 'SCHEDULED' | 'CLOSED', opensAt: Date | null, closesAt: Date | null) => {
      const survey = await pool.query<{ id: string }>(
        `INSERT INTO surveys (state, response_retention_days, created_by_user_id, updated_by_user_id)
         VALUES ('DRAFT', 365, $1, $1) RETURNING id`,
        [managerId],
      );
      const surveyId = survey.rows[0]!.id;
      await pool.query(
        `INSERT INTO survey_revisions (survey_id, revision, title_kr, title_en, created_by_user_id)
         VALUES ($1, 1, 'matcher', 'matcher', $2)`,
        [surveyId, managerId],
      );
      await pool.query(
        `WITH inserted_section AS (
           INSERT INTO survey_sections (survey_revision_id, ordinal, title_kr, title_en)
           SELECT id, 0, '기본', 'Basic' FROM survey_revisions WHERE survey_id = $1
           RETURNING id
         )
         INSERT INTO survey_questions (section_id, ordinal, type, prompt_kr, prompt_en)
         SELECT id, 0, 'SHORT_TEXT', '질문', 'Question' FROM inserted_section`,
        [surveyId],
      );
      await pool.query('UPDATE survey_revisions SET published_at = now() WHERE survey_id = $1', [surveyId]);
      await pool.query(
        'UPDATE surveys SET state = $2, opens_at = $3, closes_at = $4 WHERE id = $1',
        [surveyId, state, opensAt, closesAt],
      );
      await pool.query(
        'INSERT INTO content_matchers (event_id, survey_id, created_by_user_id) VALUES ($1, $2, $3)',
        [created.id, surveyId, managerId],
      );
      return surveyId;
    };

    const closedWithoutDates = await addMatcher('CLOSED', null, null);
    const closedWithFutureDates = await addMatcher('CLOSED', new Date(now + 86_400_000), new Date(now + 172_800_000));
    const scheduled = await addMatcher('SCHEDULED', new Date(now + 86_400_000), new Date(now + 172_800_000));
    const open = await addMatcher('OPEN', new Date(now - 86_400_000), new Date(now + 86_400_000));

    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({ surveyId: open });
    await pool.query('DELETE FROM content_matchers WHERE event_id = $1 AND survey_id = $2', [created.id, open]);
    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({ surveyId: scheduled });
    await pool.query('DELETE FROM content_matchers WHERE event_id = $1 AND survey_id = $2', [created.id, scheduled]);
    await expect(service.get(undefined, created.id, 'ko')).resolves.toMatchObject({
      surveyId: expect.stringMatching(new RegExp(`^(${closedWithoutDates}|${closedWithFutureDates})$`)),
    });
  });
});
