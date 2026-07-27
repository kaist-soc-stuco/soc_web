import { resolve } from 'node:path';

import { ForbiddenException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContactsRepository } from '../src/features/contacts/contacts.repository';
import { ContactsService } from '../src/features/contacts/contacts.service';
import { PiiCipherService } from '../src/shared/security/pii-cipher.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for contacts integration tests');
const parsedDatabaseUrl = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)
  || !['127.0.0.1', 'localhost', '[::1]'].includes(parsedDatabaseUrl.hostname)
  || parsedDatabaseUrl.search !== ''
  || !/^soc_web_(?:test|qa)_[a-z0-9_]+$/.test(parsedDatabaseUrl.pathname.slice(1))) {
  throw new Error('TEST_DATABASE_URL must target a disposable local soc_web test database');
}

const migrations = resolve(__dirname, '../drizzle');
const actorId = '61111111-1111-4111-8111-111111111111';
const deniedId = '62222222-2222-4222-8222-222222222222';
const now = new Date('2026-07-27T12:00:00.000Z');
const values = { name: 'Ada Lovelace', email: 'ada@example.test', phone: '+82-10-1234-5678', affiliation: 'KAIST', note: 'private note', kaistUid: 'ada', year: '2026', role: 'Member' };
let pool: Pool;
let repository: ContactsRepository;
let service: ContactsService;
let cipher: PiiCipherService;

const config = {
  get: (key: string) => key === 'CONTACT_PURGE_GRACE_DAYS' ? 30 : undefined,
  getOrThrow: () => undefined,
  // A fixed test-only key; this test must exercise the production envelope implementation.
  keys: JSON.stringify({ test: Buffer.alloc(32, 7).toString('base64') }),
};

/** Uses a caller-provided local TEST_DATABASE_URL; it never starts Docker or containers. */
describe('contacts PostgreSQL protocol', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: migrations });
    repository = new ContactsRepository(db as never);
    cipher = new PiiCipherService({ get: (key: string) => key === 'PII_ENCRYPTION_ACTIVE_KID' ? 'test' : key === 'PII_ENCRYPTION_KEYS_JSON' ? config.keys : undefined } as never);
    service = new ContactsService(repository, { hasPermission: async (id: string) => id === actorId } as never, cipher, { now: () => now } as never, config as never);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE contact_audit_log, contacts, permission_audit_log, permission_grants, permission_definitions, users CASCADE');
    for (const [id, subject] of [[actorId, 'contacts-actor'], [deniedId, 'contacts-denied']] as const) {
      await pool.query('INSERT INTO users (id, sso_user_id, sso_subject) VALUES ($1, $2, $3)', [id, subject, `${subject}-subject`]);
    }
    const definition = await pool.query<{ id: string }>("INSERT INTO permission_definitions (key, description) VALUES ('CONTACTS_MANAGE', 'contacts') RETURNING id");
    await pool.query("INSERT INTO permission_grants (user_id, permission_definition_id, scope, granted_by_user_id) VALUES ($1, $2, 'GLOBAL', $1)", [actorId, definition.rows[0]!.id]);
  });
  afterAll(async () => { await pool?.end(); });

  async function create(input = values, correlation = 'contact-create') {
    return service.create(actorId, { ...input, retentionDeadlineAt: new Date(now.getTime() + 90 * 86400000).toISOString() } as never, correlation);
  }
  async function seedDeleted(retention: Date, holdUntil: Date | null = null) {
    const created = await create();
    await pool.query('UPDATE contacts SET deleted_at = $2, deleted_by_user_id = $3, retention_deadline_at = $4, hold_until = $5 WHERE id = $1', [created.contact.id, now, actorId, retention, holdUntil]);
    return created.contact.id;
  }
  async function waitForLock(queryPart: string, count = 1) {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const result = await pool.query<{ count: string }>(`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE $1`, [`%${queryPart}%`]);
      if (Number(result.rows[0]?.count) >= count) return;
      await new Promise((done) => setTimeout(done, 10));
    }
    throw new Error('expected PostgreSQL lock queue was not reached');
  }

  it('persists every contact value as an encrypted envelope, returns full/masked projections, and writes value-free audits', async () => {
    const created = await create();
    const stored = await pool.query<Record<string, string>>('SELECT name_envelope, email_envelope, phone_envelope, affiliation_envelope, note_envelope, kaist_uid_envelope, year_envelope, role_envelope FROM contacts WHERE id = $1', [created.contact.id]);
    const envelopes = Object.values(stored.rows[0]!);
    expect(envelopes).toHaveLength(8);
    for (const envelope of envelopes) {
      expect(envelope).toMatch(/^enc:v1:test:/);
      expect(envelope).not.toContain('Ada Lovelace');
      expect(envelope).not.toContain('private note');
    }
    const persistedJson = (await pool.query<{ text: string }>('SELECT row_to_json(contacts)::text AS text FROM contacts WHERE id = $1', [created.contact.id])).rows[0]!.text;
    for (const secret of Object.values(values)) expect(persistedJson).not.toContain(secret);
    expect(created.contact).toMatchObject({ ...values, projection: 'FULL' });
    const masked = await service.list(actorId, { projection: 'MASKED' });
    expect(masked.items[0]).toMatchObject({ projection: 'MASKED', name: 'A***', email: '***', phone: '***', affiliation: '***', note: null, kaistUid: '***', year: '***', role: '***' });
    const audit = await pool.query<{ changed_field_names: string; text: string }>("SELECT changed_field_names, row_to_json(contact_audit_log)::text AS text FROM contact_audit_log WHERE contact_id = $1", [created.contact.id]);
    expect(audit.rows[0]!.changed_field_names).toBe('name,email,phone,affiliation,note,kaistUid,year,role,retentionDeadlineAt,holdUntil');
    for (const secret of [...Object.values(values), ...envelopes]) expect(audit.rows[0]!.text).not.toContain(secret);
  });

  it('enforces CONTACTS_MANAGE before writes and rechecks it inside the write transaction', async () => {
    await expect(service.create(deniedId, { ...values, retentionDeadlineAt: new Date(now.getTime() + 86400000).toISOString() } as never, 'denied')).rejects.toBeInstanceOf(ForbiddenException);
    expect((await pool.query('SELECT count(*) FROM contacts')).rows[0]!.count).toBe('0');

    const locker = await pool.connect();
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM permission_grants WHERE user_id = $1 FOR UPDATE', [actorId]);
      const revoke = pool.query('UPDATE permission_grants SET revoked_at = now() WHERE user_id = $1', [actorId]);
      await waitForLock('permission_grants');
      const raced = service.create(actorId, { ...values, retentionDeadlineAt: new Date(now.getTime() + 86400000).toISOString() } as never, 'revoked-race');
      await waitForLock('permission_grants', 2);
      await locker.query('COMMIT');
      await revoke;
      await expect(raced).rejects.toBeInstanceOf(ForbiddenException);
      expect((await pool.query("SELECT count(*) FROM contacts WHERE created_by_user_id = $1", [actorId])).rows[0]!.count).toBe('0');
      expect((await pool.query("SELECT count(*) FROM contact_audit_log WHERE correlation_id = 'revoked-race'")).rows[0]!.count).toBe('0');
    } finally { locker.release(); }
  });

  it('keeps create, patch, and delete changes atomic with field-name-only audit records', async () => {
    const created = await create();
    await service.patch(actorId, created.contact.id, { email: 'new@example.test', holdUntil: new Date(now.getTime() + 86400000).toISOString() } as never, 'contact-patch');
    await service.delete(actorId, created.contact.id, 'REQUESTED', 'contact-delete');
    const audit = await pool.query<{ action: string; changed_field_names: string; reason_code: string | null }>('SELECT action, changed_field_names, reason_code FROM contact_audit_log WHERE contact_id = $1 ORDER BY occurred_at, action', [created.contact.id]);
    expect(audit.rows).toEqual(expect.arrayContaining([
      { action: 'CONTACT_CREATED', changed_field_names: 'name,email,phone,affiliation,note,kaistUid,year,role,retentionDeadlineAt,holdUntil', reason_code: null },
      { action: 'CONTACT_UPDATED', changed_field_names: 'email,holdUntil', reason_code: null },
      { action: 'CONTACT_DELETED', changed_field_names: 'deletedAt', reason_code: 'REQUESTED' },
    ]));
    await expect(repository.create(actorId, {
      nameEnvelope: cipher.encrypt('name', 'rollback')!, emailEnvelope: null, phoneEnvelope: null, affiliationEnvelope: null, noteEnvelope: null, kaistUidEnvelope: null, yearEnvelope: null, roleEnvelope: null,
      retentionDeadlineAt: new Date(now.getTime() + 86400000), holdUntil: null, createdAt: now, updatedAt: now,
    } as never, { changedFieldNames: 'name', correlationId: ' ', reasonCode: null, occurredAt: now })).rejects.toBeTruthy();
    expect((await pool.query("SELECT count(*) FROM contacts WHERE name_envelope LIKE '%%'")).rows[0]!.count).toBe('1');
  });

  it('uses stable created-at/id cursor ties and validates lifecycle constraints', async () => {
    const a = await create({ ...values, name: 'Alpha' }, 'tie-a');
    const b = await create({ ...values, name: 'Beta' }, 'tie-b');
    const first = await service.list(actorId, { limit: '1' });
    const second = await service.list(actorId, { limit: '1', cursor: first.nextCursor! });
    expect([first.items[0]!.id, second.items[0]!.id].sort()).toEqual([a.contact.id, b.contact.id].sort());
    await expect(pool.query('UPDATE contacts SET retention_deadline_at = created_at - interval \'1 second\' WHERE id = $1', [a.contact.id])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE contacts SET deleted_at = created_at - interval \'1 second\', deleted_by_user_id = $2 WHERE id = $1', [a.contact.id, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE contacts SET hold_until = created_at - interval \'1 second\' WHERE id = $1', [a.contact.id])).rejects.toMatchObject({ code: '23514' });
  });

  it('applies grace-period soft deletion, excludes active holds, purges bounded SKIP LOCKED rows, and retains value-free purge audit', async () => {
    const grace = await create();
    await service.delete(actorId, grace.contact.id, 'REQUESTED', 'grace-delete');
    expect((await pool.query('SELECT retention_deadline_at FROM contacts WHERE id = $1', [grace.contact.id])).rows[0]!.retention_deadline_at.toISOString()).toBe(new Date(now.getTime() + 30 * 86400000).toISOString());
    const eligibleOne = await seedDeleted(new Date(now.getTime() - 1));
    const eligibleTwo = await seedDeleted(new Date(now.getTime() - 1));
    const held = await seedDeleted(new Date(now.getTime() - 1), new Date(now.getTime() + 86400000));
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT id FROM contacts WHERE id = $1 FOR UPDATE', [eligibleOne]);
      expect(await service.purge(1, 'purge-one')).toBe(1);
      expect((await pool.query('SELECT count(*) FROM contacts WHERE id = $1', [eligibleOne])).rows[0]!.count).toBe('1');
      await lock.query('COMMIT');
    } finally { lock.release(); }
    expect(await service.purge(10, 'purge-two')).toBe(1);
    expect((await pool.query('SELECT count(*) FROM contacts WHERE id = ANY($1)', [[eligibleOne, eligibleTwo, held]])).rows[0]!.count).toBe('1');
    expect((await pool.query('SELECT count(*) FROM contacts WHERE id = $1', [held])).rows[0]!.count).toBe('1');
    const purgeAudit = await pool.query<{ text: string }>("SELECT row_to_json(contact_audit_log)::text AS text FROM contact_audit_log WHERE action = 'CONTACT_PURGED'");
    expect(purgeAudit.rows).toHaveLength(2);
    for (const row of purgeAudit.rows) for (const secret of Object.values(values)) expect(row.text).not.toContain(secret);
  });
});
