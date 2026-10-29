import { GoneException, Injectable } from "@nestjs/common";

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

@Injectable()
export class GoogleSheetsClient {
  async getSpreadsheetReference(..._args: unknown[]): Promise<never> { throw new GoneException("google_sheets_retired"); }
  async getOrCreateSpreadsheet(..._args: unknown[]): Promise<never> { throw new GoneException("google_sheets_retired"); }
  async ensureSpreadsheetInTargetFolder(..._args: unknown[]): Promise<never> { throw new GoneException("google_sheets_retired"); }
  async syncSheet(..._args: unknown[]): Promise<never> { throw new GoneException("google_sheets_retired"); }
}
