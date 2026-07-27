import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import * as schema from '../src/infrastructure/postgres/postgres.schema';
import { PiiCipherService } from '../src/shared/security/pii-cipher.service';
import { UsersRepository } from '../src/features/users/repositories/users.repository';
import { UsersService } from '../src/features/users/users.service';
import { CONTAINER_STARTUP_TIMEOUT_MS, startTestInfrastructure, type TestInfrastructure } from './utils/test-containers';

const TIMEOUT = CONTAINER_STARTUP_TIMEOUT_MS * 3 + 30_000;
const MIGRATIONS = resolve(__dirname, '../drizzle');
const actorId = '30000000-0000-4000-8000-000000000001';
const targetId = '30000000-0000-4000-8000-000000000002';

let infrastructure: TestInfrastructure;
let pool: Pool;
let repository: UsersRepository;
let service: UsersService;
let piiCipher: PiiCipherService;

async function seed() {
  await pool.query(
    'INSERT INTO users (id, sso_user_id, sso_subject) VALUES ($1, $2, $2), ($3, $4, $4)',
    [actorId, 'fee-actor', targetId, 'fee-target'],
  );
  const definition = await pool.query<{ id: string }>(
    "INSERT INTO permission_definitions (key, description) VALUES ('FEES_MANAGE', 'fees') RETURNING id",
  );
  await pool.query(
    "INSERT INTO permission_grants (user_id, permission_definition_id, scope, granted_by_user_id) VALUES ($1, $2, 'GLOBAL', $1)",
    [actorId, definition.rows[0]!.id],
  );
}

describe('users fee PostgreSQL transaction', () => {
  beforeAll(async () => {
    infrastructure = await startTestInfrastructure();
    pool = new Pool({ connectionString: infrastructure.databaseUrl, connectionTimeoutMillis: CONTAINER_STARTUP_TIMEOUT_MS });
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
    piiCipher = new PiiCipherService({
      get: (name: string) => name === 'PII_ENCRYPTION_ACTIVE_KID'
        ? 'test-pii'
        : JSON.stringify({ 'test-pii': Buffer.alloc(32, 11).toString('base64') }),
    } as never);
    repository = new UsersRepository(drizzle(pool, { schema }) as never, piiCipher);
    service = new UsersService(repository);
  }, TIMEOUT);

  beforeEach(async () => {
    await pool.query('TRUNCATE permission_audit_log, permission_change_requests, permission_grants, permission_definitions, authorization_bootstrap_state, authorization_backfill_progress, users CASCADE');
    await seed();
  });

  afterAll(async () => {
    await Promise.all([pool?.end(), infrastructure?.stop()]);
  }, TIMEOUT);

  it('stores identity contact values only as encrypted envelopes and decrypts projections', async () => {
    const created = await repository.insert({
      privacyConsentAt: null,
      ssoUserId: 'encrypted-profile',
      userEmail: 'person@example.test',
      userMobile: '010-1234-5678',
    });
    const stored = await pool.query<{ user_email: string; user_mobile: string }>(
      'SELECT user_email, user_mobile FROM users WHERE id = $1',
      [created.id],
    );
    expect(stored.rows[0]!.user_email).toMatch(/^enc:v1:test-pii:/);
    expect(stored.rows[0]!.user_mobile).toMatch(/^enc:v1:test-pii:/);
    expect(JSON.stringify(stored.rows[0])).not.toMatch(/person@example\.test|010-1234-5678/);
    await expect(repository.findById(created.id)).resolves.toMatchObject({
      userEmail: 'person@example.test',
      userMobile: '010-1234-5678',
    });
  });
  it('updates fee and audit atomically, deduplicates a retry, and rejects a changed retry payload', async () => {
    const requestId = 'fee-request-1';
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'PAID', reasonCode: 'PAYMENT' }, requestId))
      .resolves.toMatchObject({ userId: targetId, feeStatus: 'PAID' });
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'PAID', reasonCode: 'PAYMENT' }, requestId))
      .resolves.toMatchObject({ userId: targetId, feeStatus: 'PAID' });
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE action = 'FEE_STATUS_UPDATED'")).rows[0]!.count).toBe('1');
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'UNPAID', reasonCode: 'PAYMENT' }, requestId))
      .rejects.toMatchObject({ response: { message: 'fee_update_idempotency_conflict' } });
    expect((await pool.query('SELECT fee_status FROM users WHERE id = $1', [targetId])).rows[0]!.fee_status).toBe('PAID');
  });

  it('rechecks authority in-transaction and rolls back the fee write when audit insertion fails', async () => {
    await pool.query('UPDATE permission_grants SET revoked_at = now() WHERE user_id = $1', [actorId]);
    await expect(service.updateFeeAdmin(actorId, targetId, { feeStatus: 'PAID', reasonCode: 'PAYMENT' }, 'fee-request-2'))
      .rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    expect((await pool.query('SELECT fee_status FROM users WHERE id = $1', [targetId])).rows[0]!.fee_status).toBe('UNKNOWN');

    await pool.query('UPDATE permission_grants SET revoked_at = NULL WHERE user_id = $1', [actorId]);
    await expect(repository.updateFeeWithAudit({
      actorUserId: actorId,
      feeStatus: 'PAID',
      reasonCode: 'contains pii@example.test',
      requestId: 'fee-failure-injection',
      userId: targetId,
    })).rejects.toThrow();
    expect((await pool.query('SELECT fee_status FROM users WHERE id = $1', [targetId])).rows[0]!.fee_status).toBe('UNKNOWN');
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE action = 'FEE_STATUS_UPDATED'")).rows[0]!.count).toBe('0');
  });
});
