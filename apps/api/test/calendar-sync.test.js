
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { CalendarSyncService } = require("../dist/apps/api/src/features/calendar/calendar-sync.service.js");
const { GoogleCalendarClient } = require("../dist/apps/api/src/features/calendar/google-calendar.client.js");

test("Calendar retries an unauthorized token once, without swallowing a second failure", async () => {
  const previous = global.fetch;
  const client = new GoogleCalendarClient({ get: () => undefined });
  let calls = 0, tokens = 0;
  client.getAccessToken = async () => `token-${++tokens}`;
  global.fetch = async () => ++calls === 1 ? new Response('{}', { status: 401 }) : new Response('{"id":"event"}', { status: 200 });
  try {
    assert.deepEqual(await client.send('GET', 'https://www.googleapis.com/calendar/v3/test'), { id: 'event' });
    assert.equal(calls, 2); assert.equal(tokens, 2);
    calls = 0;
    global.fetch = async () => { calls++; return new Response('{}', { status: 401 }); };
    await assert.rejects(client.send('GET', 'https://www.googleapis.com/calendar/v3/test'), /google_calendar_http_401/);
    assert.equal(calls, 2);
  } finally { global.fetch = previous; }
});

test("manual Calendar publication, failure retry, and stale-worker fence on PostgreSQL", { skip: !process.env.CALENDAR_SYNC_TEST_DATABASE_URL }, async () => {
  const name = `calendar_sync_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: process.env.CALENDAR_SYNC_TEST_DATABASE_URL });
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${name}`);
    for (const table of ['calendar_event', 'calendar_sync_job']) {
      await admin.query(`CREATE TABLE ${name}.${table} (LIKE public.${table} INCLUDING ALL)`);
      const key = table === 'calendar_event' ? 'calendar_event_id' : 'calendar_sync_job_id';
      await admin.query(`CREATE SEQUENCE ${name}.${key}_seq`);
      await admin.query(`ALTER TABLE ${name}.${table} ALTER COLUMN ${key} SET DEFAULT nextval('${name}.${key}_seq')`);
    }
    pool = new Pool({ connectionString: process.env.CALENDAR_SYNC_TEST_DATABASE_URL, options: `-c search_path=${name},public` });
    const db = drizzle(pool, { schema });
    const config = { get: (key, fallback) => key === 'GOOGLE_CALENDAR_ID' ? 'synthetic-calendar' : fallback };
    let fail = false;
    const ids = [];
    const google = { isConfigured: () => true, upsertEvent: async (input) => { ids.push(input.eventId); if (fail) throw new Error('synthetic_transient_failure'); return { eventId: input.eventId, etag: 'test-etag' }; } };
    const service = new CalendarSyncService(db, config, {}, google);
    const [event] = await db.insert(schema.calendarEvents).values({ titleKo: '합성 캘린더 검증', startAt: new Date('2030-01-01T00:00:00Z'), endAt: new Date('2030-01-01T01:00:00Z') }).returning();
    const before = await pool.query('select updated_at::text from calendar_event');
    assert.equal(await service.enqueueEvent(event.calendarEventId), false, 'automatic sync stays disabled');
    const result = await service.syncGoogleCalendars();
    assert.equal(result.succeededCount, 1, 'manual sync bypasses the automatic flag');
    assert.equal(result.failedCount, 0);
    assert.equal((await db.select().from(schema.calendarEvents))[0].googleSyncStatus, 'SYNCED');
    assert.ok(before.rows[0].updated_at);
    await service.enqueueEvent(event.calendarEventId, { manual: true });
    fail = true;
    assert.equal((await service.processPendingJobs()).failedCount, 1);
    assert.equal((await db.select().from(schema.calendarEvents))[0].googleSyncStatus, 'FAILED');
    await pool.query("update calendar_sync_job set available_at = '2000-01-01'");
    fail = false;
    assert.equal((await service.processPendingJobs()).succeededCount, 1, 'a retry can publish after FAILED');
    assert.equal(new Set(ids).size, 1, 'all retries address the same Google event');
    assert.match(ids[0], /^[0-9a-v]{5,1024}$/);
    let release, entered;
    const waiting = new Promise(r => { entered = r; });
    google.upsertEvent = async (input) => { entered(); await new Promise(r => { release = r; }); return { eventId: input.eventId, etag: 'stale' }; };
    await service.enqueueEvent(event.calendarEventId, { manual: true });
    const oldWorker = service.processPendingJobs(); await waiting;
    await db.update(schema.calendarEvents).set({ titleKo: '새 수정', updatedAt: new Date() }).where(eq(schema.calendarEvents.calendarEventId, event.calendarEventId));
    await service.enqueueEvent(event.calendarEventId, { manual: true });
    release(); await oldWorker;
    assert.equal((await db.select().from(schema.calendarEvents))[0].googleSyncStatus, 'PENDING');
    assert.equal((await db.select().from(schema.calendarSyncJobs))[0].status, 'PENDING');
  } finally {
    await pool?.end();
    assert.match(name, /^calendar_sync_test_[a-f0-9]+$/);
    await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await admin.end();
  }
});
