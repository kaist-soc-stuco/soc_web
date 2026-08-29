import { Global, Module } from "@nestjs/common";

import { PostgresModule } from "../postgres/postgres.module";
import { GoogleSheetsClient } from "./google-sheets.client";
import { GoogleSpreadsheetSyncQueueService } from "./google-spreadsheet-sync-queue.service";

@Global()
@Module({
  imports: [PostgresModule],
  providers: [GoogleSheetsClient, GoogleSpreadsheetSyncQueueService],
  exports: [GoogleSheetsClient, GoogleSpreadsheetSyncQueueService],
})
export class GoogleModule {}
