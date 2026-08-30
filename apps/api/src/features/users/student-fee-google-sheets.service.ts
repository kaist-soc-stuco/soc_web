import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "node:fs/promises";
import type {
  BulkUpdateStudentFeeStatusRequest,
  FeeStatus,
  StudentFeeGoogleSheetsStatusResponse,
  StudentFeeGoogleSheetsSyncResponse,
  StudentFeeListResponse,
} from "@soc/contracts";
import { msToDate, msToIso, nowDate, nowMs } from "@soc/shared";

import { AuditLogService } from "../audit/audit-log.service";
import {
  StudentFeeGoogleSheetsRepository,
  type StudentFeeGoogleSheetsIntegrationRow,
} from "./repositories/student-fee-google-sheets.repository";
import { UsersService } from "./users.service";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_TITLE = "과비 납부";
const SHEET_RANGE = `'${SHEET_TITLE}'!A:Q`;
const SHEET_ROW_CAPACITY = 5_000;

const HEADERS = [
  "사용자ID", "학번", "이름", "이메일", "주전공", "복수전공", "부전공",
  "상태", "적용학기수", "적용시작학기", "수납액", "기준금액", "납부유형",
  "결제수단", "혜택대상", "납부일", "비고",
] as const;

interface OAuthClientCredentials {
  client_id?: string;
  client_secret?: string;
  token_uri?: string;
}

interface OAuthClientFile {
  installed?: OAuthClientCredentials;
  web?: OAuthClientCredentials;
}

interface OAuthTokenFile {
  refresh_token?: string;
  scope?: string | string[];
}

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenUri: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface CreatedSpreadsheetResponse {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheets?: Array<{ properties?: { sheetId?: number } }>;
}

interface GoogleValuesResponse {
  values?: unknown[][];
}

class GoogleSheetsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

@Injectable()
export class StudentFeeGoogleSheetsService {
  private readonly clientFile: string;
  private readonly tokenFile: string;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly repository: StudentFeeGoogleSheetsRepository,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.clientFile = this.configService.get<string>("GOOGLE_SHEETS_OAUTH_CLIENT_FILE")?.trim()
      || "/run/secrets/google-oauth-client.json";
    this.tokenFile = this.configService.get<string>("GOOGLE_SHEETS_OAUTH_TOKEN_FILE")?.trim()
      || "/run/secrets/google-oauth-token.json";
  }

  async getStatus(): Promise<StudentFeeGoogleSheetsStatusResponse> {
    const [credentials, integration] = await Promise.all([
      this.readCredentials(false),
      this.repository.find(),
    ]);
    return {
      configured: credentials !== null,
      created: integration !== null,
      spreadsheetId: integration?.spreadsheetId ?? null,
      spreadsheetUrl: integration?.spreadsheetUrl ?? null,
      lastSyncedAt: integration?.lastSyncedAt
        ? msToIso(integration.lastSyncedAt.valueOf())
        : null,
    };
  }

  async syncToGoogleSheets(
    actorUserId: string,
    ipAddress?: string,
  ): Promise<StudentFeeGoogleSheetsSyncResponse> {
    const rows = await this.usersService.exportStudentsByFeeStatus(
      undefined,
      "studentId",
      "asc",
    );
    let integration = await this.repository.find();
    if (!integration) integration = await this.createSpreadsheet(actorUserId);

    try {
      await this.writeRows(integration.spreadsheetId, rows);
    } catch (error) {
      if (!(error instanceof GoogleSheetsApiError) || error.status !== 404) throw error;
      integration = await this.createSpreadsheet(actorUserId);
      await this.writeRows(integration.spreadsheetId, rows);
    }

    const syncedAt = nowDate();
    await this.repository.markSynced(syncedAt);
    await this.auditLogService.record({
      action: "student_fee_google_sheets.sync_to_google",
      actorUserId,
      ipAddress: ipAddress ?? null,
      payload: { count: rows.length, spreadsheetId: integration.spreadsheetId },
      targetType: "student_fee_google_sheets",
    });
    return {
      count: rows.length,
      direction: "TO_GOOGLE_SHEETS",
      spreadsheetUrl: integration.spreadsheetUrl,
      syncedAt: msToIso(syncedAt.valueOf()),
    };
  }

  async syncFromGoogleSheets(
    actorUserId: string,
    ipAddress?: string,
  ): Promise<StudentFeeGoogleSheetsSyncResponse> {
    const integration = await this.requireIntegration();
    const response = await this.googleRequest<GoogleValuesResponse>(
      `${GOOGLE_SHEETS_API}/${encodeURIComponent(integration.spreadsheetId)}/values/${encodeURIComponent(SHEET_RANGE)}`,
      { method: "GET" },
    );
    const updates = this.parseUpdates(response.values ?? []);
    for (let offset = 0; offset < updates.length; offset += 1_000) {
      await this.usersService.bulkUpdateStudentFeeStatuses(
        { updates: updates.slice(offset, offset + 1_000) },
        { actorUserId, ipAddress },
      );
    }

    const syncedAt = nowDate();
    await this.repository.markSynced(syncedAt);
    await this.auditLogService.record({
      action: "student_fee_google_sheets.sync_from_google",
      actorUserId,
      ipAddress: ipAddress ?? null,
      payload: { count: updates.length, spreadsheetId: integration.spreadsheetId },
      targetType: "student_fee_google_sheets",
    });
    return {
      count: updates.length,
      direction: "FROM_GOOGLE_SHEETS",
      spreadsheetUrl: integration.spreadsheetUrl,
      syncedAt: msToIso(syncedAt.valueOf()),
    };
  }

  private async readCredentials(required: true): Promise<GoogleCredentials>;
  private async readCredentials(required: false): Promise<GoogleCredentials | null>;
  private async readCredentials(required: boolean): Promise<GoogleCredentials | null> {
    try {
      const [clientRaw, tokenRaw] = await Promise.all([
        readFile(this.clientFile, "utf8"),
        readFile(this.tokenFile, "utf8"),
      ]);
      const clientFile = JSON.parse(clientRaw) as OAuthClientFile;
      const tokenFile = JSON.parse(tokenRaw) as OAuthTokenFile;
      const client = clientFile.installed ?? clientFile.web;
      const scopes = Array.isArray(tokenFile.scope)
        ? tokenFile.scope
        : (tokenFile.scope ?? "").split(/\s+/).filter(Boolean);
      const hasWritableSheetScope = scopes.includes(GOOGLE_DRIVE_FILE_SCOPE)
        || scopes.includes(GOOGLE_SPREADSHEETS_SCOPE);
      if (!client?.client_id || !client.client_secret || !tokenFile.refresh_token || !hasWritableSheetScope) {
        throw new Error("google_sheets_oauth_secret_invalid");
      }
      return {
        clientId: client.client_id,
        clientSecret: client.client_secret,
        refreshToken: tokenFile.refresh_token,
        tokenUri: client.token_uri || GOOGLE_TOKEN_URL,
      };
    } catch {
      if (required) {
        throw new ServiceUnavailableException("google_sheets_oauth_secret_missing_or_invalid");
      }
      return null;
    }
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh
      && this.cachedAccessToken
      && this.cachedAccessToken.expiresAt > nowMs() + 60_000
    ) {
      return this.cachedAccessToken.token;
    }
    const credentials = await this.readCredentials(true);
    const response = await fetch(credentials.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
      }).toString(),
    });
    const token = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !token.access_token) {
      throw new ServiceUnavailableException("google_sheets_token_refresh_failed");
    }
    this.cachedAccessToken = {
      token: token.access_token,
      expiresAt: nowMs() + (token.expires_in ?? 3_600) * 1_000,
    };
    return token.access_token;
  }

  private async googleRequest<T>(url: string, init: RequestInit): Promise<T> {
    let token = await this.accessToken();
    let response = await this.sendGoogleRequest(url, init, token);
    if (response.status === 401) {
      token = await this.accessToken(true);
      response = await this.sendGoogleRequest(url, init, token);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new GoogleSheetsApiError(
        response.status,
        `google_sheets_api_failed:${response.status}:${detail.slice(0, 200)}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private sendGoogleRequest(url: string, init: RequestInit, token: string): Promise<Response> {
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  private async requireIntegration(): Promise<StudentFeeGoogleSheetsIntegrationRow> {
    const integration = await this.repository.find();
    if (!integration) throw new BadRequestException("google_sheets_not_created");
    return integration;
  }

  private async createSpreadsheet(
    actorUserId: string,
  ): Promise<StudentFeeGoogleSheetsIntegrationRow> {
    const created = await this.googleRequest<CreatedSpreadsheetResponse>(
      GOOGLE_SHEETS_API,
      {
        method: "POST",
        body: JSON.stringify({
          properties: { title: `SOC 과비 관리 ${msToDate(nowMs()).getUTCFullYear()}` },
          sheets: [{ properties: {
            title: SHEET_TITLE,
            gridProperties: {
              frozenRowCount: 1,
              rowCount: SHEET_ROW_CAPACITY,
              columnCount: HEADERS.length,
            },
          } }],
        }),
      },
    );
    if (!created.spreadsheetId || !created.spreadsheetUrl) {
      throw new BadGatewayException("google_sheets_create_response_invalid");
    }
    const sheetId = created.sheets?.[0]?.properties?.sheetId;
    if (sheetId !== undefined) await this.formatSpreadsheet(created.spreadsheetId, sheetId);
    return this.repository.saveSpreadsheet({
      createdBy: actorUserId,
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
    });
  }

  private async formatSpreadsheet(spreadsheetId: string, sheetId: number): Promise<void> {
    await this.googleRequest(
      `${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({ requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: {
                backgroundColor: { red: 0.86, green: 0.94, blue: 0.89 },
                textFormat: { bold: true },
              } },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
              properties: { hiddenByUser: true },
              fields: "hiddenByUser",
            },
          },
          {
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: SHEET_ROW_CAPACITY,
                startColumnIndex: 7,
                endColumnIndex: 8,
              },
              rule: {
                condition: {
                  type: "ONE_OF_LIST",
                  values: ["완납", "부분 납부", "미납"]
                    .map((userEnteredValue) => ({ userEnteredValue })),
                },
                strict: true,
                showCustomUi: true,
              },
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 1,
                endIndex: HEADERS.length,
              },
            },
          },
        ] }),
      },
    );
  }

  private async writeRows(
    spreadsheetId: string,
    rows: StudentFeeListResponse["students"],
  ): Promise<void> {
    await this.googleRequest(
      `${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      { method: "POST", body: JSON.stringify({ ranges: [`'${SHEET_TITLE}'!A2:Q`] }) },
    );
    await this.googleRequest(
      `${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEET_RANGE)}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: [HEADERS, ...rows.map((row) => this.rowValues(row))],
        }),
      },
    );
  }

  private rowValues(row: StudentFeeListResponse["students"][number]): unknown[] {
    return [
      row.userId,
      row.stdNo ?? "",
      row.nameKo,
      row.email,
      row.primaryMajor ?? "",
      row.doubleMajor ?? "",
      row.minor ?? "",
      row.status === "PAID" ? "완납" : row.status === "PARTIAL" ? "부분 납부" : "미납",
      row.coverageSemesters,
      row.coverageStartSemester ?? "",
      row.paidAmount,
      row.requiredAmount ?? "",
      row.paymentType === "PRIOR_PAYMENT_BALANCE"
        ? "기납부 차액"
        : row.paymentType === "SIX_SEMESTER_LUMP_SUM" ? "6학기 일시납" : "",
      row.paymentMethod === "BANK_TRANSFER"
        ? "계좌이체"
        : row.paymentMethod === "CASH"
          ? "현금"
          : row.paymentMethod === "OTHER" ? "기타" : "",
      row.eligible ? "예" : "아니오",
      row.paidAt ?? "",
      row.note ?? "",
    ];
  }

  private parseUpdates(values: unknown[][]): BulkUpdateStudentFeeStatusRequest["updates"] {
    if (values.length < 2) throw new BadRequestException("google_sheets_has_no_data_rows");
    const normalize = (value: unknown) => String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const headers = values[0].map(normalize);
    const indexOf = (...aliases: string[]) =>
      headers.findIndex((header) => aliases.includes(header));
    const indexes = {
      userId: indexOf("userid", "사용자id"),
      stdNo: indexOf("stdno", "학번"),
      status: indexOf("status", "상태", "납부여부"),
      paidAmount: indexOf("paidamount", "납부금액", "실납부액", "수납액", "금액"),
      coverageSemesters: indexOf("coveragesemesters", "적용학기", "적용학기수"),
      note: indexOf("note", "비고", "메모"),
    };
    if (indexes.userId < 0 && indexes.stdNo < 0) {
      throw new BadRequestException("google_sheets_user_identifier_column_missing");
    }
    if (
      indexes.status < 0
      || indexes.paidAmount < 0
      || indexes.coverageSemesters < 0
      || indexes.note < 0
    ) {
      throw new BadRequestException("google_sheets_editable_columns_missing");
    }

    const updates: BulkUpdateStudentFeeStatusRequest["updates"] = [];
    const errors: string[] = [];
    const identifiers = new Set<string>();
    values.slice(1).forEach((row, rowIndex) => {
      const value = (index: number) => index >= 0 ? String(row[index] ?? "").trim() : "";
      const userId = value(indexes.userId);
      const stdNo = value(indexes.stdNo);
      if (!userId && !stdNo && row.every((cell) => String(cell ?? "").trim() === "")) return;
      const rowLabel = `${rowIndex + 2}행`;
      const identifier = userId || stdNo;
      if (!identifier) errors.push(`${rowLabel}: 사용자 ID 또는 학번이 없습니다.`);
      if (
        userId
        && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ) {
        errors.push(`${rowLabel}: 사용자 ID 형식이 올바르지 않습니다.`);
      }
      if (stdNo.length > 30) errors.push(`${rowLabel}: 학번이 너무 깁니다.`);
      if (identifier && identifiers.has(identifier)) {
        errors.push(`${rowLabel}: 중복된 사용자입니다.`);
      }
      if (identifier) identifiers.add(identifier);

      const rawStatus = value(indexes.status).toUpperCase().replace(/\s+/g, "");
      const status: FeeStatus | undefined =
        rawStatus === "PAID" || rawStatus === "완납" || rawStatus === "납부완료"
          ? "PAID"
          : rawStatus === "PARTIAL" || rawStatus === "부분" || rawStatus === "부분납부"
            ? "PARTIAL"
            : rawStatus === "UNPAID" || rawStatus === "미납" || rawStatus === "미납부"
              ? "UNPAID"
              : undefined;
      if (rawStatus && !status) errors.push(`${rowLabel}: 상태 값이 올바르지 않습니다.`);

      const amountText = value(indexes.paidAmount).replace(/,/g, "");
      const paidAmount = amountText ? Number(amountText) : undefined;
      if (
        paidAmount !== undefined
        && (!Number.isInteger(paidAmount) || paidAmount < 0 || paidAmount > 100_000_000)
      ) {
        errors.push(`${rowLabel}: 수납액은 0 이상의 정수여야 합니다.`);
      }
      const coverageText = value(indexes.coverageSemesters);
      const coverageSemesters = coverageText ? Number(coverageText) : undefined;
      if (
        coverageSemesters !== undefined
        && (!Number.isInteger(coverageSemesters) || coverageSemesters < 1 || coverageSemesters > 6)
      ) {
        errors.push(`${rowLabel}: 적용 학기 수는 1～6 사이여야 합니다.`);
      }
      if (errors.some((error) => error.startsWith(`${rowLabel}:`))) return;
      updates.push({
        ...(userId ? { userId } : {}),
        ...(stdNo ? { stdNo } : {}),
        ...(status ? { status } : {}),
        ...(paidAmount !== undefined ? { paidAmount } : {}),
        ...(coverageSemesters !== undefined ? { coverageSemesters } : {}),
        note: value(indexes.note) || null,
      });
    });
    if (errors.length > 0) {
      throw new BadRequestException(
        `google_sheets_validation_failed:${errors.slice(0, 10).join(" ")}`,
      );
    }
    if (updates.length === 0) throw new BadRequestException("google_sheets_has_no_updates");
    return updates;
  }
}
