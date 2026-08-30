import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  type PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { studentFeeGoogleSheetsIntegration } from "../../../infrastructure/postgres/postgres.schema";

const INTEGRATION_KEY = "student_fee";

export type StudentFeeGoogleSheetsIntegrationRow =
  typeof studentFeeGoogleSheetsIntegration.$inferSelect;

@Injectable()
export class StudentFeeGoogleSheetsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async find(): Promise<StudentFeeGoogleSheetsIntegrationRow | null> {
    const rows = await this.db
      .select()
      .from(studentFeeGoogleSheetsIntegration)
      .where(eq(studentFeeGoogleSheetsIntegration.integrationKey, INTEGRATION_KEY))
      .limit(1);
    return rows[0] ?? null;
  }

  async saveSpreadsheet(input: {
    createdBy: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
  }): Promise<StudentFeeGoogleSheetsIntegrationRow> {
    const now = nowDate();
    const rows = await this.db
      .insert(studentFeeGoogleSheetsIntegration)
      .values({
        integrationKey: INTEGRATION_KEY,
        createdBy: input.createdBy,
        spreadsheetId: input.spreadsheetId,
        spreadsheetUrl: input.spreadsheetUrl,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: studentFeeGoogleSheetsIntegration.integrationKey,
        set: {
          createdBy: input.createdBy,
          spreadsheetId: input.spreadsheetId,
          spreadsheetUrl: input.spreadsheetUrl,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0]!;
  }

  async markSynced(syncedAt: Date): Promise<void> {
    await this.db
      .update(studentFeeGoogleSheetsIntegration)
      .set({ lastSyncedAt: syncedAt, updatedAt: syncedAt })
      .where(eq(studentFeeGoogleSheetsIntegration.integrationKey, INTEGRATION_KEY));
  }
}
