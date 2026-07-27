import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CONTAINER_STARTUP_TIMEOUT_MS,
  startTestInfrastructure,
  type TestInfrastructure,
} from './utils/test-containers';

const TEST_TIMEOUT_MS = CONTAINER_STARTUP_TIMEOUT_MS * 3 + 30_000;
const MIGRATIONS_FOLDER = resolve(__dirname, '../drizzle');
const JOURNAL_PATH = resolve(MIGRATIONS_FOLDER, 'meta/_journal.json');
const GETDEL_KEY = 'infrastructure:getdel:00000000-0000-4000-8000-000000000001';
const CAS_KEY = 'infrastructure:cas:00000000-0000-4000-8000-000000000002';

let infrastructure: TestInfrastructure;
let postgres: Pool;
let redis: Redis;

describe('containerized infrastructure', () => {
  beforeAll(async () => {
    infrastructure = await startTestInfrastructure();
    postgres = new Pool({
      connectionString: infrastructure.databaseUrl,
      connectionTimeoutMillis: CONTAINER_STARTUP_TIMEOUT_MS,
    });
    redis = new Redis(infrastructure.redisUrl, {
      connectTimeout: CONTAINER_STARTUP_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
    });

    await redis.ping();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    const cleanup = await Promise.allSettled([
      redis?.quit(),
      postgres?.end(),
      infrastructure?.stop(),
    ]);
    const failures = cleanup.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failures.length > 0) {
      throw new AggregateError(
        failures.flatMap((failure) =>
          failure.reason instanceof AggregateError ? failure.reason.errors : [failure.reason],
        ),
        'Failed to tear down test infrastructure',
      );
    }
  }, TEST_TIMEOUT_MS);

  it('connects to PostgreSQL and applies the append-only Drizzle migrations', async () => {
    const connection = await postgres.query<{ connected: number }>('SELECT 1 AS connected');
    expect(connection.rows).toEqual([{ connected: 1 }]);

    await migrate(drizzle(postgres), { migrationsFolder: MIGRATIONS_FOLDER });

    const usersTable = await postgres.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'",
    );
    expect(usersTable.rows).toEqual([{ table_name: 'users' }]);

    const migrationJournal = await postgres.query<{ count: string }>(
      'SELECT count(*) FROM "drizzle"."__drizzle_migrations"',
    );
    const journal = JSON.parse(await readFile(JOURNAL_PATH, 'utf8')) as {
      entries: unknown[];
    };
    expect(migrationJournal.rows[0]?.count).toBe(String(journal.entries.length));
  });

  it('supports Redis GETDEL atomically', async () => {
    await redis.set(GETDEL_KEY, 'fixed-value');

    await expect(redis.call('GETDEL', GETDEL_KEY)).resolves.toBe('fixed-value');
    await expect(redis.get(GETDEL_KEY)).resolves.toBeNull();
  });

  it('supports a minimal Lua compare-and-update primitive', async () => {
    await redis.set(CAS_KEY, 'expected');

    const compareAndUpdate = async (expected: string, replacement: string): Promise<number> => {
      const result = await redis.eval(
        "local current = redis.call('GET', KEYS[1])\nif current ~= ARGV[1] then return 0 end\nredis.call('SET', KEYS[1], ARGV[2])\nreturn 1",
        1,
        CAS_KEY,
        expected,
        replacement,
      );
      return Number(result);
    };

    await expect(compareAndUpdate('expected', 'updated')).resolves.toBe(1);
    await expect(compareAndUpdate('expected', 'should-not-write')).resolves.toBe(0);
    await expect(redis.get(CAS_KEY)).resolves.toBe('updated');
  });
});
