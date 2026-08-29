import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ContactSpreadsheetSyncResponse } from "@soc/contracts";
import { nowIso } from "@soc/shared";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import { ContactsRepository } from "./contacts.repository";

const SHEET_TITLE = "연락망";
const SPREADSHEET_PURPOSE = "executive-contacts";

@Injectable()
export class GoogleContactSheetsService {
  constructor(
    private readonly config: ConfigService,
    private readonly sheets: GoogleSheetsClient,
    private readonly contactsRepo: ContactsRepository,
  ) {}

  async sync(): Promise<ContactSpreadsheetSyncResponse> {
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

    return {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
      syncedCount: contacts.items.length,
      syncedAt: nowIso(),
    };
  }
}

function formatActivityYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}
