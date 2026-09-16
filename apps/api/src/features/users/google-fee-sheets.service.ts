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
  type GoogleSpreadsheetSyncJobContext,
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
    this.syncQueue.registerHandler(GOOGLE_SHEET_RESOURCE.STUDENT_FEES, (_resourceKey, job) =>
      this.sync({}, undefined, job).then(() => undefined),
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
    job?: GoogleSpreadsheetSyncJobContext,
  ): Promise<StudentFeeSpreadsheetSyncResponse> {
    try {
      return await this.syncInternal(options, audit, job);
    } catch (error) {
      await this.recordAuditSafely({
        action: "student_fee.spreadsheet.sync",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: {
          executor: job ? "background-worker" : "request",
          jobId: job?.jobId ?? null,
          resource: job?.resourceKey ?? "global",
          revision: job?.revision ?? null,
          result: "failed",
          errorCode: error instanceof Error ? error.name : "unknown_error",
        },
        targetId: job?.resourceKey ?? "student-fee-status",
        targetType: "student_fee_status",
      });
      throw error;
    }
  }

  private async syncInternal(
    options: FeeSpreadsheetSyncOptions = {},
    audit?: AuditMetadata,
    job?: GoogleSpreadsheetSyncJobContext,
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

    if (job && !(await job.isCurrentClaim())) {
      throw new Error("google_sheet_sync_claim_lost");
    }

    await this.sheets.syncSheet({
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetTitle: SHEET_TITLE,
      headers: [
        "학번",
        "이름",
        "이메일",
        "소속",
        "주전공",
        "상태",
        "납부 적용 학기 수",
        "납부 적용 시작 학기",
        "총 수납액",
        "기준 납부액",
        "납부 유형",
        "결제 수단",
        "납부 일자",
        "비고",
        "사용자 ID",
      ],
      rows: rows.map((row) => [
        row.stdNo ?? "",
        row.nameKo,
        row.email,
        row.departmentKo ?? "",
        row.primaryMajor ?? "",
        row.status,
        row.coverageSemesters,
        row.coverageStartSemester ?? "",
        row.paidAmount,
        row.requiredAmount ?? "",
        row.paymentType ?? "",
        row.paymentMethod ?? "",
        row.paidAt ?? "",
        row.note ?? "",
        row.userId,
      ]),
      dateTimeColumns: [12],
      columnWidths: [105, 110, 240, 160, 160, 100, 145, 165, 125, 125, 180, 180, 155, 260, 270],
      protectionDescription: "KAIST SOC · 과비 납부 (읽기 전용)",
    });

    const result = {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
      syncedCount: rows.length,
      syncedAt: nowIso(),
    };
    await this.recordAuditSafely({
      action: "student_fee.spreadsheet.sync",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        executor: job ? "background-worker" : "request",
        jobId: job?.jobId ?? null,
        resource: job?.resourceKey ?? "global",
        revision: job?.revision ?? null,
        result: "succeeded",
        syncedCount: result.syncedCount,
      },
      targetId: result.spreadsheetId,
      targetType: "student_fee_status",
    });
    return result;
  }

  private async recordAuditSafely(input: {
    action: string;
    actorUserId: string | null;
    ipAddress: string | null;
    payload: Record<string, unknown>;
    targetId: string;
    targetType: string;
  }): Promise<void> {
    try {
      await this.auditLogService?.record(input);
    } catch {
      // Do not rerun a Google write merely because its audit row failed.
    }
  }
}
