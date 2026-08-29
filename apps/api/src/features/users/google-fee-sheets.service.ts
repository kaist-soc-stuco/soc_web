import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import type {
  StudentFeeListOptions,
  StudentFeeSpreadsheetSyncResponse,
} from "@soc/contracts";
import { nowIso } from "@soc/shared";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import {
  GOOGLE_SHEET_RESOURCE,
  GoogleSpreadsheetSyncQueueService,
} from "../../infrastructure/google/google-spreadsheet-sync-queue.service";
import { resolveFeeReferenceSemester } from "./fee-semester";
import { UsersService } from "./users.service";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";

const SHEET_TITLE = "과비 납부";
const SPREADSHEET_PURPOSE = "student-fees";

type FeeSpreadsheetSyncOptions = Pick<
  StudentFeeListOptions,
  | "status"
  | "sortBy"
  | "sortDirection"
  | "query"
  | "paymentYear"
  | "majorCategory"
  | "referenceSemester"
  | "userIds"
>;

@Injectable()
export class GoogleFeeSheetsService implements OnModuleInit {
  constructor(
    private readonly sheets: GoogleSheetsClient,
    private readonly usersService: UsersService,
    private readonly syncQueue: GoogleSpreadsheetSyncQueueService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  onModuleInit(): void {
    this.syncQueue.registerHandler(GOOGLE_SHEET_RESOURCE.STUDENT_FEES, () =>
      this.sync().then(() => undefined),
    );
  }

  async getReference(audit?: AuditMetadata) {
    const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
      title: "KAIST SOC 과비 납부",
      sheetTitle: SHEET_TITLE,
      purpose: SPREADSHEET_PURPOSE,
    });
    await this.syncQueue.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);
    await this.auditLogService?.record({
      action: "student_fee.spreadsheet.connect",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { operation: "get_or_create", spreadsheetId: spreadsheet.spreadsheetId },
      targetId: spreadsheet.spreadsheetId,
      targetType: "student_fee_status",
    });
    return spreadsheet;
  }

  async sync(
    options: FeeSpreadsheetSyncOptions = {},
    audit?: AuditMetadata,
  ): Promise<StudentFeeSpreadsheetSyncResponse> {
    const referenceSemester = resolveFeeReferenceSemester(options.referenceSemester);
    const rows = await this.usersService.exportStudentsByFeeStatus(
      options.status,
      options.sortBy,
      options.sortDirection,
      options.query,
      options.paymentYear,
      options.majorCategory,
      referenceSemester,
      options.userIds,
    );
    const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
      title: "KAIST SOC 과비 납부",
      sheetTitle: SHEET_TITLE,
      purpose: SPREADSHEET_PURPOSE,
    });

    await this.sheets.syncSheet({
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetTitle: SHEET_TITLE,
      headers: [
        "사용자ID",
        "학번",
        "이름",
        "이메일",
        "주전공",
        "상태",
        "적용 학기 수",
        "적용 시작 학기",
        "수납액",
        "기준 금액",
        "납부 유형",
        "결제 수단",
        "기준 학기",
        "기준 학기 혜택 자격",
        "납부일",
        "비고",
      ],
      rows: rows.map((row) => [
        row.userId,
        row.stdNo ?? "",
        row.nameKo,
        row.email,
        row.primaryMajor ?? "",
        row.status,
        row.coverageSemesters,
        row.coverageStartSemester ?? "",
        row.paidAmount,
        row.requiredAmount ?? "",
        row.paymentType ?? "",
        row.paymentMethod ?? "",
        referenceSemester,
        row.eligible ? "예" : "아니오",
        row.paidAt ?? "",
        row.note ?? "",
      ]),
      dateTimeColumns: [14],
      columnWidths: [270, 105, 110, 240, 160, 100, 115, 145, 115, 115, 180, 140, 105, 180, 155, 260],
      protectionDescription: "KAIST SOC · 과비 납부 (읽기 전용)",
    });

    const result = {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
      syncedCount: rows.length,
      syncedAt: nowIso(),
    };
    if (audit) {
      await this.auditLogService?.record({
        action: "student_fee.spreadsheet.sync",
        actorUserId: audit.actorUserId ?? null,
        ipAddress: audit.ipAddress ?? null,
        payload: { syncedCount: result.syncedCount, spreadsheetId: result.spreadsheetId },
        targetId: result.spreadsheetId,
        targetType: "student_fee_status",
      });
    }
    return result;
  }
}
