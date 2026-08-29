import { readFile } from "node:fs/promises";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ContactSpreadsheetSyncResponse } from "@soc/contracts";
import { nowIso, nowMs } from "@soc/shared";

import { ContactsRepository } from "./contacts.repository";

interface GoogleOAuthClient {
  client_id: string;
  client_secret: string;
  token_uri?: string;
}

interface GoogleOAuthClientFile {
  installed?: GoogleOAuthClient;
  web?: GoogleOAuthClient;
}

interface GoogleOAuthTokenFile {
  refresh_token?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const SHEET_TITLE = "연락망";
const SPREADSHEET_PURPOSE = "executive-contacts";

@Injectable()
export class GoogleContactSheetsService {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly contactsRepo: ContactsRepository,
  ) {}

  async sync(): Promise<ContactSpreadsheetSyncResponse> {
    const contacts = await this.contactsRepo.findManaged({ page: 1, pageSize: 500 });
    const spreadsheetId = await this.getOrCreateSpreadsheet();
    const values: Array<Array<string | number>> = [
      [
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
      ...contacts.items.map((contact) => [
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
    ];

    const range = encodeURIComponent(`'${SHEET_TITLE}'!A:ZZ`);
    await this.request(
      "POST",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:clear`,
      {},
    );
    await this.request(
      "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
      { majorDimension: "ROWS", values },
    );

    const syncedAt = nowIso();
    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedCount: contacts.items.length,
      syncedAt,
    };
  }

  private async getOrCreateSpreadsheet(): Promise<string> {
    const configuredId = this.config.get<string>("GOOGLE_CONTACTS_SPREADSHEET_ID")?.trim();
    if (configuredId) return configuredId;

    const query = new URLSearchParams({
      q: [
        "mimeType = 'application/vnd.google-apps.spreadsheet'",
        "trashed = false",
        `appProperties has { key='socPurpose' and value='${SPREADSHEET_PURPOSE}' }`,
      ].join(" and "),
      spaces: "drive",
      fields: "files(id)",
      pageSize: "1",
    });
    const existing = await this.request<{ files?: Array<{ id: string }> }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${query.toString()}`,
    );
    const existingId = existing.files?.[0]?.id;
    if (existingId) return existingId;

    const created = await this.request<{ spreadsheetId?: string }>(
      "POST",
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        properties: { title: "KAIST SOC 집행위 연락망" },
        sheets: [{ properties: { title: SHEET_TITLE, gridProperties: { frozenRowCount: 1 } } }],
      },
    );
    if (!created.spreadsheetId) throw new Error("google_contacts_spreadsheet_create_failed");

    await this.request(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.spreadsheetId)}?fields=id`,
      { appProperties: { socPurpose: SPREADSHEET_PURPOSE } },
    );
    return created.spreadsheetId;
  }

  private async request<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`google_workspace_http_${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > nowMs() + 60_000) {
      return this.cachedToken.value;
    }
    const clientFile = this.config.get<string>("GOOGLE_OAUTH_CLIENT_KEY_FILE")?.trim();
    const tokenFile = this.config.get<string>("GOOGLE_OAUTH_TOKEN_FILE")?.trim();
    if (!clientFile) throw new Error("google_oauth_client_file_not_configured");
    if (!tokenFile) throw new Error("google_oauth_token_file_not_configured");

    const clientDocument = JSON.parse(await readFile(clientFile, "utf8")) as GoogleOAuthClientFile;
    const client = clientDocument.installed ?? clientDocument.web;
    const token = JSON.parse(await readFile(tokenFile, "utf8")) as GoogleOAuthTokenFile;
    if (!client?.client_id || !client.client_secret) throw new Error("google_oauth_client_file_invalid");
    if (!token.refresh_token) throw new Error("google_oauth_refresh_token_missing");

    const response = await fetch(client.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      const detail = payload.error_description ?? payload.error;
      throw new Error(`google_oauth_token_failed${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    this.cachedToken = {
      value: payload.access_token,
      expiresAt: nowMs() + Math.max((payload.expires_in ?? 3_600) - 60, 60) * 1_000,
    };
    return payload.access_token;
  }
}

function formatActivityYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}
