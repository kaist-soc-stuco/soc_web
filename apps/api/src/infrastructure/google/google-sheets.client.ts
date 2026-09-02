import { readFile } from "node:fs/promises";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nowMs } from "@soc/shared";

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

interface GoogleSpreadsheetCreateResponse {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

interface GoogleSheetMetadata {
  properties?: {
    sheetId?: number;
    title?: string;
    gridProperties?: { rowCount?: number; columnCount?: number };
  };
  protectedRanges?: Array<{
    protectedRangeId?: number;
    description?: string;
  }>;
}

interface GoogleSpreadsheetMetadata {
  sheets?: GoogleSheetMetadata[];
}

export type GoogleSheetCellValue = string | number | boolean | null | Date;

export interface GoogleSpreadsheetReference {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export interface GoogleSheetSyncDefinition {
  spreadsheetId: string;
  sheetTitle: string;
  headers: string[];
  rows: ReadonlyArray<ReadonlyArray<GoogleSheetCellValue>>;
  dateTimeColumns?: number[];
  columnWidths?: number[];
  protectionDescription: string;
}

const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const DEFAULT_SPREADSHEET_URL = (spreadsheetId: string) =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

@Injectable()
export class GoogleSheetsClient {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async getOrCreateSpreadsheet(options: {
    configuredSpreadsheetId?: string | null;
    duplicateTitle?: string;
    ensureUniqueTitle?: boolean;
    title: string;
    sheetTitle: string;
    purpose: string;
    key?: string;
  }): Promise<GoogleSpreadsheetReference> {
    const targetFolderId = this.getTargetFolderId();
    await this.assertFolderWritable(targetFolderId);

    const configuredSpreadsheetId = options.configuredSpreadsheetId?.trim() || undefined;
    const spreadsheetId =
      configuredSpreadsheetId ?? (await this.findSpreadsheetId(options.purpose, options.key));

    if (spreadsheetId) {
      await this.ensureSpreadsheetInTargetFolder(spreadsheetId);
      return {
        spreadsheetId,
        spreadsheetUrl: DEFAULT_SPREADSHEET_URL(spreadsheetId),
      };
    }

    const spreadsheetTitle = options.ensureUniqueTitle
      ? await this.findAvailableSpreadsheetTitle(
          options.title,
          targetFolderId,
          options.duplicateTitle,
        )
      : options.title;

    const created = await this.request<GoogleSpreadsheetCreateResponse>(
      "POST",
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        properties: { title: spreadsheetTitle },
        sheets: [
          {
            properties: {
              title: options.sheetTitle,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    );
    if (!created.spreadsheetId) throw new Error("google_spreadsheet_create_failed");

    await this.setSpreadsheetProperties(created.spreadsheetId, options.purpose, options.key);
    await this.ensureSpreadsheetInTargetFolder(created.spreadsheetId);

    return {
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl ?? DEFAULT_SPREADSHEET_URL(created.spreadsheetId),
    };
  }

  async ensureSpreadsheetInTargetFolder(spreadsheetId: string): Promise<void> {
    const folderId = this.getTargetFolderId();
    await this.assertFolderWritable(folderId);
    const current = await this.request<{ parents?: string[] }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents&supportsAllDrives=true`,
    );
    const otherParents = (current.parents ?? []).filter((parentId) => parentId !== folderId);
    if (current.parents?.length === 1 && current.parents[0] === folderId) return;

    const query = new URLSearchParams({
      addParents: folderId,
      supportsAllDrives: "true",
      fields: "id,parents,webViewLink",
    });
    if (otherParents.length > 0) query.set("removeParents", otherParents.join(","));
    await this.request(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?${query.toString()}`,
      {},
    );
  }

  async syncSheet(definition: GoogleSheetSyncDefinition): Promise<void> {
    if (definition.headers.length === 0) throw new Error("google_spreadsheet_headers_required");

    const metadata = await this.getSpreadsheetMetadata(definition.spreadsheetId);
    const sheet = metadata.sheets?.find(
      (candidate) => candidate.properties?.title === definition.sheetTitle,
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) {
      throw new Error(`google_spreadsheet_sheet_not_found:${definition.sheetTitle}`);
    }

    const dateTimeColumns = new Set(definition.dateTimeColumns ?? []);
    const values = [definition.headers, ...definition.rows].map((row) =>
      definition.headers.map((_, columnIndex) =>
        this.normalizeCellValue(row[columnIndex] ?? "", dateTimeColumns.has(columnIndex)),
      ),
    );
    const encodedRange = encodeURIComponent(`'${quoteSheetTitle(definition.sheetTitle)}'!A:ZZ`);
    await this.request(
      "POST",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(definition.spreadsheetId)}/values/${encodedRange}:clear`,
      {},
    );
    await this.request(
      "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(definition.spreadsheetId)}/values/${encodedRange}?valueInputOption=RAW`,
      { majorDimension: "ROWS", values },
    );

    await this.applyStandardFormatting(
      definition.spreadsheetId,
      sheetId,
      definition.headers.length,
      values.length,
      definition.dateTimeColumns ?? [],
      definition.columnWidths ?? [],
      definition.protectionDescription,
      sheet?.protectedRanges ?? [],
    );
  }

  private async findSpreadsheetId(purpose: string, key?: string): Promise<string | null> {
    const predicates = [
      `mimeType = '${GOOGLE_SHEETS_MIME}'`,
      "trashed = false",
      `appProperties has { key='socPurpose' and value='${escapeDriveQueryValue(purpose)}' }`,
    ];
    if (key) {
      predicates.push(
        `appProperties has { key='socKey' and value='${escapeDriveQueryValue(key)}' }`,
      );
    }
    const query = new URLSearchParams({
      q: predicates.join(" and "),
      spaces: "drive",
      fields: "files(id)",
      pageSize: "1",
    });
    const found = await this.request<{ files?: Array<{ id?: string }> }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${query.toString()}`,
    );
    return found.files?.[0]?.id ?? null;
  }

  private async findAvailableSpreadsheetTitle(
    baseTitle: string,
    folderId: string,
    duplicateTitle = baseTitle,
  ): Promise<string> {
    const titleSearches = [...new Set([baseTitle, duplicateTitle])].map(
      (title) => `name contains '${escapeDriveQueryValue(title)}'`,
    );
    const predicates = [
      `mimeType = '${GOOGLE_SHEETS_MIME}'`,
      "trashed = false",
      `'${escapeDriveQueryValue(folderId)}' in parents`,
      titleSearches.length === 1 ? titleSearches[0] : `(${titleSearches.join(" or ")})`,
    ];
    const query = new URLSearchParams({
      q: predicates.join(" and "),
      spaces: "drive",
      fields: "files(name)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const found = await this.request<{ files?: Array<{ name?: string }> }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${query.toString()}`,
    );
    const existingTitles = new Set(
      (found.files ?? [])
        .map((file) => file.name)
        .filter((name): name is string => Boolean(name)),
    );
    if (!existingTitles.has(baseTitle)) return baseTitle;

    let suffix = 1;
    while (
      existingTitles.has(`${duplicateTitle} (${suffix})`) ||
      existingTitles.has(`${baseTitle} (${suffix})`)
    ) {
      suffix += 1;
    }
    return `${duplicateTitle} (${suffix})`;
  }

  private async setSpreadsheetProperties(
    spreadsheetId: string,
    purpose: string,
    key?: string,
  ): Promise<void> {
    await this.request(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=id,parents,appProperties`,
      {
        appProperties: {
          socPurpose: purpose,
          ...(key ? { socKey: key } : {}),
        },
      },
    );
  }

  private async getSpreadsheetMetadata(spreadsheetId: string): Promise<GoogleSpreadsheetMetadata> {
    return this.request<GoogleSpreadsheetMetadata>(
      "GET",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false`,
    );
  }

  private async applyStandardFormatting(
    spreadsheetId: string,
    sheetId: number,
    columnCount: number,
    rowCount: number,
    dateTimeColumns: number[],
    columnWidths: number[],
    protectionDescription: string,
    protectedRanges: Array<{ protectedRangeId?: number; description?: string }>,
  ): Promise<void> {
    const requests: Array<Record<string, unknown>> = [
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColorStyle: { rgbColor: { red: 0.96, green: 0.97, blue: 0.98 } },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "WRAP",
              textFormat: {
                bold: true,
                foregroundColorStyle: { rgbColor: { red: 0.12, green: 0.16, blue: 0.22 } },
              },
            },
          },
          fields:
            "userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)",
        },
      },
    ];

    for (const [columnIndex, width] of columnWidths.entries()) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: columnIndex,
            endIndex: columnIndex + 1,
          },
          properties: { pixelSize: Math.max(80, Math.round(width)) },
          fields: "pixelSize",
        },
      });
    }

    if (rowCount > 1) {
      for (const columnIndex of dateTimeColumns) {
        if (columnIndex < 0 || columnIndex >= columnCount) continue;
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: rowCount,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        });
      }
    }

    const existingProtection = protectedRanges.find(
      (protectedRange) => protectedRange.description === protectionDescription,
    );
    if (existingProtection?.protectedRangeId !== undefined) {
      requests.push({
        updateProtectedRange: {
          protectedRange: {
            protectedRangeId: existingProtection.protectedRangeId,
            description: protectionDescription,
            warningOnly: false,
            range: { sheetId },
          },
          fields: "description,warningOnly,range",
        },
      });
    } else {
      requests.push({
        addProtectedRange: {
          protectedRange: {
            description: protectionDescription,
            warningOnly: false,
            range: { sheetId },
          },
        },
      });
    }

    await this.request(
      "POST",
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      { requests },
    );
  }

  private normalizeCellValue(value: GoogleSheetCellValue, isDateTime: boolean): string | number | boolean {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return toGoogleSerialDate(value);
    if (isDateTime && typeof value === "string" && value.trim()) {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) return toGoogleSerialDate(timestamp);
    }
    return value;
  }

  private getTargetFolderId(): string {
    const folderId = this.config.get<string>("GOOGLE_OPERATIONS_FOLDER_ID")?.trim();
    if (!folderId) throw new Error("google_operations_folder_not_configured");
    return folderId;
  }

  private async assertFolderWritable(folderId: string): Promise<void> {
    const folder = await this.request<{
      mimeType?: string;
      trashed?: boolean;
      capabilities?: { canAddChildren?: boolean };
    }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`,
    );
    if (
      folder.mimeType !== "application/vnd.google-apps.folder" ||
      folder.trashed === true ||
      folder.capabilities?.canAddChildren !== true
    ) {
      throw new Error("google_operations_folder_not_writable");
    }
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
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `google_workspace_http_${response.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`,
      );
    }
    return responseText ? (JSON.parse(responseText) as T) : (undefined as T);
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
    if (!client?.client_id || !client.client_secret) {
      throw new Error("google_oauth_client_file_invalid");
    }
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
      throw new Error(
        `google_oauth_token_failed${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }

    this.cachedToken = {
      value: payload.access_token,
      expiresAt: nowMs() + Math.max((payload.expires_in ?? 3_600) - 60, 60) * 1_000,
    };
    return payload.access_token;
  }
}

function quoteSheetTitle(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function toGoogleSerialDate(value: Date | number): number {
  const timestamp = typeof value === "number" ? value : value.getTime();
  return timestamp / 86_400_000 + 25_569;
}
