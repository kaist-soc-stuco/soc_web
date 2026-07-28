import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PermissionsRepository } from '../src/features/permissions/permissions.repository';
import { PermissionsService } from '../src/features/permissions/permissions.service';
import { migrateWithCompletedPiiBackfill } from './utils/staged-migrations';
import { CONTAINER_STARTUP_TIMEOUT_MS, startTestInfrastructure, type TestInfrastructure } from './utils/test-containers';

const TIMEOUT = CONTAINER_STARTUP_TIMEOUT_MS * 3 + 30_000;
const ids = {
  requester: '10000000-0000-4000-8000-000000000001', target: '10000000-0000-4000-8000-000000000002',
  approver: '10000000-0000-4000-8000-000000000003', activator: '10000000-0000-4000-8000-000000000004',
};
let infrastructure: TestInfrastructure;
let pool: Pool;
let repository: PermissionsRepository;
let service: PermissionsService;

async function seedUser(id: string, subject = `subject-${id}`) {
  await pool.query('INSERT INTO users (id, sso_user_id, sso_subject, permission) VALUES ($1, $2, $3, 127)', [id, `sso-${id}`, subject]);
}
async function definition(key: string) {
  const result = await pool.query<{ id: string }>('INSERT INTO permission_definitions (key, description) VALUES ($1, $2) RETURNING id', [key, key]);
  return result.rows[0]!.id;
}
async function grant(userId: string, definitionId: string, scope = 'GLOBAL', scopeId: string | null = null, expiresAt: Date | null = null) {
  await pool.query('INSERT INTO permission_grants (user_id, permission_definition_id, scope, scope_id, granted_by_user_id, expires_at) VALUES ($1, $2, $3, $4, $1, $5)', [userId, definitionId, scope, scopeId, expiresAt]);
}
async function base() {
  for (const id of Object.values(ids)) await seedUser(id);
  const keys = await Promise.all(['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE', 'FEE_WRITE'].map(definition));
  await grant(ids.requester, keys[0]!);
  await grant(ids.requester, keys[1]!);
  await grant(ids.approver, keys[2]!);
  await grant(ids.activator, keys[3]!);
  return Object.fromEntries(['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE', 'FEE_WRITE'].map((key, i) => [key, keys[i]!])) as Record<string, string>;
}

describe('permissions PostgreSQL protocol', () => {
  beforeAll(async () => {
    infrastructure = await startTestInfrastructure();
    pool = new Pool({ connectionString: infrastructure.databaseUrl, connectionTimeoutMillis: CONTAINER_STARTUP_TIMEOUT_MS });
    await migrateWithCompletedPiiBackfill(pool);
    repository = new PermissionsRepository(drizzle(pool) as never);
    service = new PermissionsService(repository, { get: () => 'bootstrap-subject' } as never);
  }, TIMEOUT);
  beforeEach(async () => {
    await pool.query('TRUNCATE permission_audit_log, permission_change_requests, permission_grants, permission_definitions, authorization_bootstrap_state, authorization_backfill_progress, users CASCADE');
  });
  afterAll(async () => { await Promise.all([pool?.end(), infrastructure?.stop()]); }, TIMEOUT);

  it('uses only live grants with exact/global containment; missing, expired, and revoked grants deny', async () => {
    const definitions = await base();
    await grant(ids.requester, definitions.FEE_WRITE, 'BOARD', 'board-a');
    expect(await service.hasPermission(ids.requester, 'FEE_WRITE', 'BOARD', 'board-a')).toBe(true);
    expect(await service.hasPermission(ids.requester, 'FEE_WRITE', 'BOARD', 'board-b')).toBe(false);
    expect(await service.hasPermission(ids.requester, 'FEE_WRITE', 'EVENT', 'event-a')).toBe(false);
    await grant(ids.target, definitions.FEE_WRITE, 'GLOBAL');
    expect(await service.hasPermission(ids.target, 'FEE_WRITE', 'EVENT', 'event-a')).toBe(true);
    await grant(ids.approver, definitions.FEE_WRITE, 'BOARD', 'expired', new Date(Date.now() - 1));
    expect(await service.hasPermission(ids.approver, 'FEE_WRITE', 'BOARD', 'expired')).toBe(false);
    await pool.query("UPDATE permission_grants SET revoked_at = now() WHERE user_id = $1 AND permission_definition_id = $2", [ids.target, definitions.FEE_WRITE]);
    expect(await service.hasPermission(ids.target, 'FEE_WRITE', 'EVENT', 'event-a')).toBe(false);
  });

  it('enforces GRANT/REVOKE authority, dual control, hash integrity, state order, recheck, exactly-once grants, and revoke', async () => {
    const definitions = await base();
    await expect(service.request(ids.approver, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' })).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    await expect(service.request(ids.approver, { targetUserId: ids.target, action: 'REVOKE', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' })).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    const pending = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    expect(Date.parse(pending.expiresAt)).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    await expect(service.activate(ids.activator, pending.id, 'ACTIVATE')).rejects.toMatchObject({ response: { message: 'permission_request_not_activatable' } });
    await expect(service.approve(ids.requester, pending.id, 'NO')).rejects.toMatchObject({ response: { message: 'permission_request_not_approvable' } });
    await expect(service.approve(ids.target, pending.id, 'NO')).rejects.toMatchObject({ response: { message: 'permission_request_not_approvable' } });
    await service.approve(ids.approver, pending.id, 'REVIEWED');
    await expect(service.activate(ids.requester, pending.id, 'NO')).rejects.toMatchObject({ response: { message: 'permission_request_not_activatable' } });
    await service.activate(ids.activator, pending.id, 'ACTIVATE');
    await expect(service.activate(ids.activator, pending.id, 'AGAIN')).rejects.toMatchObject({ response: { message: 'permission_request_not_activatable' } });
    expect((await pool.query('SELECT * FROM permission_grants WHERE user_id = $1 AND permission_definition_id = $2 AND revoked_at IS NULL', [ids.target, definitions.FEE_WRITE])).rowCount).toBe(1);
    const revoke = await service.request(ids.requester, { targetUserId: ids.target, action: 'REVOKE', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    await service.approve(ids.approver, revoke.id, 'REVIEWED');
    await service.activate(ids.activator, revoke.id, 'ACTIVATE');
    expect(await service.hasPermission(ids.target, 'FEE_WRITE', 'BOARD', 'board-a')).toBe(false);

    const tampered = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-b', reasonCode: 'OPS' });
    await expect(pool.query("UPDATE permission_change_requests SET request_hash = 'tampered' WHERE id = $1", [tampered.id])).rejects.toThrow('permission change request payload is immutable');
    await expect(pool.query("UPDATE permission_change_requests SET scope_id = 'board-c' WHERE id = $1", [tampered.id])).rejects.toThrow('permission change request payload is immutable');
    await expect(pool.query("UPDATE permission_change_requests SET status = 'ACTIVATED' WHERE id = $1", [tampered.id])).rejects.toThrow('invalid permission change request transition');
    await expect(pool.query("UPDATE permission_change_requests SET status = 'APPROVED' WHERE id = $1", [tampered.id])).rejects.toThrow('approval metadata is required');
    await expect(service.approve(ids.approver, tampered.id, 'REVIEWED')).resolves.toMatchObject({ status: 'APPROVED' });
  });

  it('rechecks transactional authority, expires stale requests, and emits minimized audit fields without PII', async () => {
    const definitions = await base();
    const pending = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    await pool.query("UPDATE permission_grants SET revoked_at = now() WHERE user_id = $1 AND permission_definition_id = $2", [ids.approver, definitions.PERMISSION_APPROVE]);
    await expect(service.approve(ids.approver, pending.id, 'REVIEWED')).rejects.toMatchObject({ response: { message: 'permission_request_not_approvable' } });
    await grant(ids.approver, definitions.PERMISSION_APPROVE);
    await pool.query('ALTER TABLE permission_change_requests DISABLE TRIGGER permission_change_requests_prevent_payload_mutation, DISABLE TRIGGER permission_change_requests_enforce_transition');
    await pool.query("UPDATE permission_change_requests SET expires_at = now() - interval '1 second' WHERE id = $1", [pending.id]);
    await pool.query('ALTER TABLE permission_change_requests ENABLE TRIGGER permission_change_requests_prevent_payload_mutation, ENABLE TRIGGER permission_change_requests_enforce_transition');
    await expect(service.approve(ids.approver, pending.id, 'REVIEWED')).rejects.toMatchObject({ response: { message: 'permission_request_not_approvable' } });
    expect((await pool.query('SELECT status FROM permission_change_requests WHERE id = $1', [pending.id])).rows[0]!.status).toBe('EXPIRED');
    const activationRecheck = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-c', reasonCode: 'OPS' });
    await service.approve(ids.approver, activationRecheck.id, 'REVIEWED');
    await pool.query("UPDATE permission_grants SET revoked_at = now() WHERE user_id = $1 AND permission_definition_id = $2", [ids.activator, definitions.PERMISSION_ACTIVATE]);
    await expect(service.activate(ids.activator, activationRecheck.id, 'ACTIVATE')).rejects.toMatchObject({ response: { message: 'permission_request_not_activatable' } });
    const audit = await pool.query('SELECT changed_field_names, reason_code FROM permission_audit_log');
    for (const row of audit.rows as Array<{ changed_field_names: string; reason_code: string | null }>) {
      expect(row.changed_field_names).not.toMatch(/userEmail|userMobile|kaistUid|studentOrEmployeeNumber|before|afterValue/i);
      expect(row.reason_code).not.toMatch(/@|010-/);
    }
  });

  it('bootstraps only once and rejects wrong subject, missing definitions, or any existing grant', async () => {
    await seedUser(ids.requester, 'bootstrap-subject');
    await pool.query("UPDATE users SET sso_subject = 'wrong' WHERE id = $1", [ids.requester]);
    await expect(service.bootstrap(ids.requester)).rejects.toMatchObject({ response: { message: 'bootstrap_subject_not_authorized' } });
    await pool.query("UPDATE users SET sso_subject = 'bootstrap-subject' WHERE id = $1", [ids.requester]);
    await expect(service.bootstrap(ids.requester)).rejects.toMatchObject({ response: { message: 'authorization_bootstrap_refused' } });
    for (const key of ['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE']) await definition(key);
    await expect(service.bootstrap(ids.requester)).resolves.toBe(true);
    await expect(service.bootstrap(ids.requester)).rejects.toMatchObject({ response: { message: 'authorization_bootstrap_refused' } });
    expect((await pool.query('SELECT count(*) FROM permission_grants')).rows[0]!.count).toBe('4');
  });
  it('refuses bootstrap when any effective grant already exists', async () => {
    await seedUser(ids.requester, 'bootstrap-subject');
    const definitions = await Promise.all(['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE'].map(definition));
    await grant(ids.requester, definitions[0]!);
    await expect(service.bootstrap(ids.requester)).rejects.toMatchObject({ response: { message: 'authorization_bootstrap_refused' } });
  });

  it('backfills 500 rows resumably and treats ambiguous legacy values as denial without grants', async () => {
    const values = Array.from({ length: 501 }, (_, index) => `('20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}', 'legacy-${index}', ${index === 0 ? 3 : 0})`).join(',');
    await pool.query(`INSERT INTO users (id, sso_user_id, permission) VALUES ${values}`);
    await expect(service.backfillLegacyPermissions()).resolves.toEqual({ processed: 500, completed: false });
    await seedUser('20000000-0000-4000-8000-999999999999', 'outside-frozen-bound-501');
    await expect(service.backfillLegacyPermissions()).resolves.toEqual({ processed: 1, completed: false });
    await expect(service.backfillLegacyPermissions()).resolves.toEqual({ processed: 0, completed: true });
    expect((await pool.query('SELECT count(*) FROM permission_grants')).rows[0]!.count).toBe('0');
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE action = 'LEGACY_PERMISSION_DENIED_REVIEW' ")).rows[0]!.count).toBe('1');
  });
  it('denies future-dated authority and uses an exact 24-hour database request lifetime', async () => {
    const definitions = await base();
    await pool.query("UPDATE permission_grants SET activated_from = now() + interval '1 second' WHERE user_id = $1 AND permission_definition_id = $2", [ids.requester, definitions.PERMISSION_GRANT]);
    await expect(service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' })).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    await pool.query("UPDATE permission_grants SET activated_from = now() WHERE user_id = $1 AND permission_definition_id = $2", [ids.requester, definitions.PERMISSION_GRANT]);
    const request = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    const lifetime = await pool.query<{ seconds: string }>("SELECT extract(epoch FROM expires_at - requested_at)::text AS seconds FROM permission_change_requests WHERE id = $1", [request.id]);
    expect(lifetime.rows[0]!.seconds).toBe('86400.000000');
  });

  it('activates a concurrent request exactly once and replaces an expired unrevoked grant', async () => {
    const definitions = await base();
    await grant(ids.target, definitions.FEE_WRITE, 'BOARD', 'board-a', new Date('2000-01-01T00:00:00.000Z'));
    const request = await service.request(ids.requester, { targetUserId: ids.target, action: 'GRANT', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    await service.approve(ids.approver, request.id, 'REVIEWED');
    const activations = await Promise.allSettled([
      service.activate(ids.activator, request.id, 'ACTIVATE'),
      service.activate(ids.activator, request.id, 'ACTIVATE'),
    ]);
    expect(activations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(activations.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await pool.query("SELECT count(*) FROM permission_grants WHERE user_id = $1 AND permission_definition_id = $2 AND scope_id = 'board-a' AND revoked_at IS NULL AND expires_at IS NULL", [ids.target, definitions.FEE_WRITE])).rows[0]!.count).toBe('1');
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE record_id = $1 AND action = 'PERMISSION_GRANT_ACTIVATED'", [request.id])).rows[0]!.count).toBe('1');
  });

  it('bootstraps concurrently exactly once', async () => {
    await seedUser(ids.requester, 'bootstrap-subject');
    for (const key of ['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE']) await definition(key);
    const attempts = await Promise.allSettled([service.bootstrap(ids.requester), service.bootstrap(ids.requester)]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await pool.query('SELECT count(*) FROM authorization_bootstrap_state WHERE completed_at IS NOT NULL')).rows[0]!.count).toBe('1');
    expect((await pool.query('SELECT count(*) FROM permission_grants')).rows[0]!.count).toBe('4');
  });

  it('freezes the backfill upper bound, resumes batches, and handles 499 rows', async () => {
    const values = Array.from({ length: 499 }, (_, index) => `('30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}', 'legacy-${index}', 0)`).join(',');
    await pool.query(`INSERT INTO users (id, sso_user_id, permission) VALUES ${values}`);
    await expect(service.backfillLegacyPermissions()).resolves.toEqual({ processed: 499, completed: false });
    await seedUser('30000000-0000-4000-8000-999999999999', 'outside-frozen-bound');
    await expect(service.backfillLegacyPermissions()).resolves.toEqual({ processed: 0, completed: true });
    const progress = await pool.query<{ upper_bound_user_id: string; last_processed_user_id: string }>('SELECT upper_bound_user_id, last_processed_user_id FROM authorization_backfill_progress');
    expect(progress.rows[0]).toMatchObject({ upper_bound_user_id: '30000000-0000-4000-8000-000000000499', last_processed_user_id: '30000000-0000-4000-8000-000000000499' });
  });

  it('rolls back a no-op revoke without a success audit event', async () => {
    await base();
    const request = await service.request(ids.requester, { targetUserId: ids.target, action: 'REVOKE', permission: 'FEE_WRITE', scope: 'BOARD', scopeId: 'board-a', reasonCode: 'OPS' });
    await service.approve(ids.approver, request.id, 'REVIEWED');
    await expect(service.activate(ids.activator, request.id, 'ACTIVATE')).rejects.toMatchObject({ response: { message: 'permission_request_not_activatable' } });
    expect((await pool.query('SELECT status FROM permission_change_requests WHERE id = $1', [request.id])).rows[0]!.status).toBe('APPROVED');
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE record_id = $1 AND action = 'PERMISSION_REVOKE_ACTIVATED'", [request.id])).rows[0]!.count).toBe('0');
  });

  it('paginates tied audit timestamps with the composite cursor', async () => {
    await base();
    await pool.query('TRUNCATE permission_audit_log');
    const timestamp = '2025-01-01T00:00:00.000Z';
    const idsForAudit = ['40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002'];
    for (const id of idsForAudit) await pool.query("INSERT INTO permission_audit_log (id, action, record_id, changed_field_names, correlation_id, occurred_at) VALUES ($1, 'AUDIT_EVENT', $1, 'status', 'cursor-test', $2)", [id, timestamp]);
    const first = await service.listAudit(1);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.listAudit(1, first.nextCursor!);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    expect(new Set([...first.items, ...second.items].map((entry) => entry.id))).toEqual(new Set(idsForAudit));
  });
  it('enforces append-only permission audit history while allowing inserts', async () => {
    const id = '50000000-0000-4000-8000-000000000001';
    await pool.query("INSERT INTO permission_audit_log (id, action, record_id, changed_field_names, correlation_id) VALUES ($1, 'AUDIT_EVENT', $1, 'status', 'append-only-test')", [id]);
    await expect(pool.query("UPDATE permission_audit_log SET action = 'AUDIT_CHANGED' WHERE id = $1", [id])).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM permission_audit_log WHERE id = $1', [id])).rejects.toThrow(/append-only/);
    expect((await pool.query('SELECT action FROM permission_audit_log WHERE id = $1', [id])).rows).toEqual([{ action: 'AUDIT_EVENT' }]);
  });
});
