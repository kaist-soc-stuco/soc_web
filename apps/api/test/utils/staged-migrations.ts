import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

const migrationsFolder = resolve(__dirname, '../../drizzle');

export async function migrateWithCompletedPiiBackfill(pool: Pool): Promise<void> {
  const temporaryFolder = await mkdtemp(join(tmpdir(), 'soc-web-migrations-'));
  try {
    const stagedFolder = join(temporaryFolder, 'drizzle');
    await cp(migrationsFolder, stagedFolder, { recursive: true });
    await rm(join(stagedFolder, '0013_phase2_pii_contract_gate.sql'));

    const journalPath = join(stagedFolder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number }> };
    journal.entries = journal.entries.filter((entry) => entry.idx < 13);
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    await migrate(drizzle(pool), { migrationsFolder: stagedFolder });
    await pool.query(
      "INSERT INTO user_pii_backfill_progress (job_key, completed_at) VALUES ('users', now()) ON CONFLICT (job_key) DO UPDATE SET completed_at = EXCLUDED.completed_at",
    );
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await rm(temporaryFolder, { recursive: true, force: true });
  }
}
