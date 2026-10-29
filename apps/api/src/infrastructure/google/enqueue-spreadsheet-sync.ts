import type { PostgresDatabase } from "../postgres/postgres.provider";

/** Retired: preserve internal writes without creating external sync jobs. */
export async function enqueueSpreadsheetSync(_db: Pick<PostgresDatabase, "insert">, _resourceType: string, _resourceKey = "global"): Promise<void> {}
