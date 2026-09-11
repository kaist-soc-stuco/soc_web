import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ContactSpreadsheetSyncResponse } from "@soc/contracts";
import { nowIso } from "@soc/shared";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import {
  GOOGLE_SHEET_RESOURCE,
  GoogleSpreadsheetSyncQueueService,
  type GoogleSpreadsheetSyncJobContext,
} from "../../infrastructure/google/google-spreadsheet-sync-queue.service";
import { ContactsRepository } from "./contacts.repository";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";

const SHEET_TITLE = "연락망";
const SPREADSHEET_PURPOSE = "executive-contacts";

@Injectable()
export class GoogleContactSheetsService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly sheets: GoogleSheetsClient,
    private readonly contactsRepo: ContactsRepository,
    private readonly syncQueue: GoogleSpreadsheetSyncQueueService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  onModuleInit(): void {
    this.syncQueue.registerHandler(GOOGLE_SHEET_RESOURCE.CONTACTS, (_resourceKey, job) =>
      this.sync(undefined, job).then(() => undefined),
    );
  }

  async enqueueSync(): Promise<void> {
    await this.syncQueue.enqueue(GOOGLE_SHEET_RESOURCE.CONTACTS);
  }

  async getReference(audit?: AuditMetadata) {
    const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
      configuredSpreadsheetId: this.config.get<string>("GOOGLE_CONTACTS_SPREADSHEET_ID"),
      title: "KAIST SOC 집행위 연락망",
      sheetTitle: SHEET_TITLE,
      purpose: SPREADSHEET_PURPOSE,
    });
    await this.syncQueue.enqueue(GOOGLE_SHEET_RESOURCE.CONTACTS);
    await this.recordAuditSafely({
      action: "executive_contact.spreadsheet.connect",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { operation: "get_or_create", spreadsheetId: spreadsheet.spreadsheetId },
      targetId: spreadsheet.spreadsheetId,
      targetType: "executive_contact",
    });
    return spreadsheet;
  }

  async sync(
    audit?: AuditMetadata,
    job?: GoogleSpreadsheetSyncJobContext,
  ): Promise<ContactSpreadsheetSyncResponse> {
    let spreadsheet: { spreadsheetId: string; spreadsheetUrl: string } | null = null;
    const auditContext = {
      executor: job ? "background-worker" : "request",
      jobId: job?.jobId ?? null,
      resourceKey: job?.resourceKey ?? "global",
      resourceType: job?.resourceType ?? GOOGLE_SHEET_RESOURCE.CONTACTS,
      revision: job?.revision ?? null,
    };

    try {
      spreadsheet = await this.sheets.getOrCreateSpreadsheet({
        configuredSpreadsheetId: this.config.get<string>("GOOGLE_CONTACTS_SPREADSHEET_ID"),
        title: "KAIST SOC 집행위 연락망",
        sheetTitle: SHEET_TITLE,
        purpose: SPREADSHEET_PURPOSE,
      });

      // Read consent immediately before constructing the external payload. A
      // revoke deletes the local row and queues another full replacement, so
      // retries never reuse an old PII snapshot.
      const contacts = await this.contactsRepo.findManaged({ page: 1, pageSize: 500, privacyConsented: true });
      for (let page = 2; contacts.items.length < (contacts.total ?? contacts.items.length); page += 1) {
        const next = await this.contactsRepo.findManaged({ page, pageSize: 500, privacyConsented: true });
        if (!next.items.length) break;
        contacts.items.push(...next.items);
      }

      if (job && typeof job.isCurrentClaim === "function" && !(await job.isCurrentClaim())) {
        throw new Error("google_sheet_sync_claim_lost");
      }

      await this.sheets.syncSheet({
        spreadsheetId: spreadsheet.spreadsheetId,
        sheetTitle: SHEET_TITLE,
        headers: [
          "이름",
          "학번",
          "부서",
          "직책",
          "활동 연도",
          "이메일",
          "전화번호",
          "연락처 ID",
          "활동 이력",
        ],
        rows: contacts.items.map((contact) => [
          contact.nameKo,
          contact.studentNumber ?? "",
          contact.departmentKo ?? "",
          contact.roleKo,
          contact.cohort ? formatActivityYear(contact.cohort) : "",
          contact.email ?? "",
          contact.phoneNumber ?? "",
          contact.id,
          (contact.activities ?? []).map((activity) => `${activity.year} / ${activity.departmentKo} / ${activity.roleKo}`).join("\n"),
        ]),
        columnWidths: [120, 100, 140, 140, 100, 230, 140, 280, 360],
        protectionDescription: "KAIST SOC · 집행부원 연락망 (읽기 전용)",
      });

      const result = {
        spreadsheetId: spreadsheet.spreadsheetId,
        spreadsheetUrl: spreadsheet.spreadsheetUrl,
        syncedCount: contacts.items.length,
        syncedAt: nowIso(),
      };
      await this.recordAuditSafely({
        action: "executive_contact.spreadsheet.sync",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: {
          ...auditContext,
          result: "succeeded",
          syncedCount: result.syncedCount,
        },
        targetId: result.spreadsheetId,
        targetType: "executive_contact",
      });
      return result;
    } catch (error) {
      await this.recordAuditSafely({
        action: "executive_contact.spreadsheet.sync",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: {
          ...auditContext,
          result: "failed",
          errorCode: error instanceof Error ? error.name : "unknown_error",
        },
        targetId: spreadsheet?.spreadsheetId ?? null,
        targetType: "executive_contact",
      });
      throw error;
    }
  }

  private async recordAuditSafely(input: {
    action: string;
    actorUserId: string | null;
    ipAddress: string | null;
    payload: Record<string, unknown>;
    targetId: string | null;
    targetType: string;
  }): Promise<void> {
    try {
      await this.auditLogService?.record(input);
    } catch {
      // The Google write is already complete; audit retry must not rerun it.
    }
  }
}

function formatActivityYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}
