import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { UsersRepository } from "./repositories/users.repository";
import { getStudentFeeBootstrapRecords } from "./student-fee-bootstrap-loader";
import { GOOGLE_SHEET_RESOURCE, GoogleSpreadsheetSyncQueueService } from "../../infrastructure/google/google-spreadsheet-sync-queue.service";

@Injectable()
export class StudentFeeRosterImportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StudentFeeRosterImportService.name);

  constructor(private readonly repository: UsersRepository, private readonly queue: GoogleSpreadsheetSyncQueueService) {}

  async onApplicationBootstrap(): Promise<void> {
    const records = getStudentFeeBootstrapRecords();
    if (!records) return;
    const result = await this.repository.importStudentFeeRoster(records);
    this.logger.log(`Initial fee ledger: ${records.length} records read, ${result.insertedCount} inserted, ${result.linkedCount} accounts linked.`);
    if (result.insertedCount || result.linkedCount) {
      try { await this.queue.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES); }
      catch { this.logger.warn("initial_fee_roster_mirror_enqueue_failed"); }
    }
  }
}
