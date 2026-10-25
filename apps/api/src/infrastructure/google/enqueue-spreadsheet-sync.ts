import { sql } from "drizzle-orm";
import { nowDate } from "@soc/shared";
import type { PostgresDatabase } from "../postgres/postgres.provider";
import { googleSpreadsheetSyncJobs } from "../postgres/postgres.schema";

/** Accepts the caller's transaction so the data and refresh job commit together. */
export async function enqueueSpreadsheetSync(
  db: Pick<PostgresDatabase, "insert">,
  resourceType: string,
  resourceKey = "global",
): Promise<void> {
  await db.insert(googleSpreadsheetSyncJobs).values({
    resourceType, resourceKey, status: "PENDING", revision: 1, attempts: 0,
    availableAt: nowDate(), lockedAt: null, leaseUntil: null, claimToken: null, lastError: null,
  }).onConflictDoUpdate({
    target: [googleSpreadsheetSyncJobs.resourceType, googleSpreadsheetSyncJobs.resourceKey],
    set: {
      status: "PENDING", revision: sql`${googleSpreadsheetSyncJobs.revision} + 1`, attempts: 0,
      availableAt: nowDate(), lockedAt: null, leaseUntil: null, claimToken: null,
      lastError: null, updatedAt: nowDate(),
    },
  });
}
