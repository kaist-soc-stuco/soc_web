import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ContactSpreadsheetSyncResponse } from "@soc/contracts";
import { nowIso } from "@soc/shared";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import {
  GOOGLE_SHEET_RESOURCE,
  GoogleSpreadsheetSyncQueueService,
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
    this.syncQueue.registerHandler(GOOGLE_SHEET_RESOURCE.CONTACTS, () =>
      this.sync().then(() => undefined),
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
    await this.auditLogService?.record({
      action: "executive_contact.spreadsheet.connect",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { operation: "get_or_create", spreadsheetId: spreadsheet.spreadsheetId },
      targetId: spreadsheet.spreadsheetId,
      targetType: "executive_contact",
    });
    return spreadsheet;
  }

  async sync(audit?: AuditMetadata): Promise<ContactSpreadsheetSyncResponse> {
    const contacts = await this.contactsRepo.findManaged({ page: 1, pageSize: 500 });
    const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
      configuredSpreadsheetId: this.config.get<string>("GOOGLE_CONTACTS_SPREADSHEET_ID"),
      title: "KAIST SOC 집행위 연락망",
      sheetTitle: SHEET_TITLE,
      purpose: SPREADSHEET_PURPOSE,
    });

    await this.sheets.syncSheet({
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetTitle: SHEET_TITLE,
      headers: [
        "이름",
        "영문명",
        "학번",
        "부서",
        "영문부서",
        "직책",
        "영문직책",
        "활동 연도",
        "이메일",
        "전화번호",
      ],
      rows: contacts.items.map((contact) => [
        contact.nameKo,
        contact.nameEn,
        contact.studentNumber ?? "",
        contact.departmentKo ?? "",
        contact.departmentEn ?? "",
        contact.roleKo,
        contact.roleEn,
        contact.cohort ? formatActivityYear(contact.cohort) : "",
        contact.email ?? "",
        contact.phoneNumber ?? "",
      ]),
      columnWidths: [120, 160, 100, 140, 160, 140, 160, 100, 230, 140],
      protectionDescription: "KAIST SOC · 집행부원 연락망 (읽기 전용)",
    });

    const result = {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
      syncedCount: contacts.items.length,
      syncedAt: nowIso(),
    };
    if (audit) {
      await this.auditLogService?.record({
        action: "executive_contact.spreadsheet.sync",
        actorUserId: audit.actorUserId ?? null,
        ipAddress: audit.ipAddress ?? null,
        payload: { syncedCount: result.syncedCount, spreadsheetId: result.spreadsheetId },
        targetId: result.spreadsheetId,
        targetType: "executive_contact",
      });
    }
    return result;
  }
}

function formatActivityYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}
