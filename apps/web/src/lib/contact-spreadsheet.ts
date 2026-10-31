import * as XLSX from "xlsx";

export interface ParsedContactSpreadsheetRow {
  nameKo: string;
  nameEn: string;
  departmentKo: string;
  departmentEn: string;
  roleKo: string;
  roleEn: string;
  studentNumber: string;
  email: string;
  phoneNumber: string;
  privacyConsented: boolean;
}

export interface ContactSpreadsheetParseResult {
  rows: ParsedContactSpreadsheetRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<Exclude<keyof ParsedContactSpreadsheetRow, "privacyConsented">, string[]> = {
  nameKo: ["nameko", "이름", "이름(한글)", "이름(국문)"],
  nameEn: ["nameen", "영문이름", "이름(영문)"],
  departmentKo: ["departmentko", "부서", "부서(한글)", "부서(국문)"],
  departmentEn: ["departmenten", "영문부서", "부서(영문)"],
  roleKo: ["roleko", "직책", "역할", "직책(한글)", "역할(한글)"],
  roleEn: ["roleen", "영문직책", "직책(영문)", "역할(영문)"],
  studentNumber: ["studentnumber", "학번", "학생번호"],
  email: ["email", "이메일", "메일"],
  phoneNumber: ["phonenumber", "phone", "전화번호", "연락처", "휴대전화"],
};

const requiredFields: Array<keyof ParsedContactSpreadsheetRow> = ["nameKo", "roleKo"];

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value: unknown) {
  return normalizeCell(value)
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function parseContactSpreadsheet(input: ArrayBuffer): ContactSpreadsheetParseResult {
  let rows: unknown[][];
  try {
    const workbook = XLSX.read(input, { type: "array", cellDates: false, raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { rows: [], errors: ["연락망 시트가 없습니다."] };
    rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
  } catch {
    return { rows: [], errors: ["XLSX 파일을 읽지 못했습니다."] };
  }

  if (rows.length < 2) {
    return { rows: [], errors: ["헤더를 포함한 연락망 XLSX 파일을 선택해 주세요."] };
  }

  const headerCells = rows[0].map(normalizeHeader);
  const columnIndexes = new Map<keyof ParsedContactSpreadsheetRow, number>();
  (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach((field) => {
    const index = headerCells.findIndex((header) =>
      HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === header),
    );
    if (index >= 0) columnIndexes.set(field, index);
  });

  const fieldLabels: Partial<Record<keyof ParsedContactSpreadsheetRow, string>> = { nameKo: "이름", roleKo: "직책" };
  const missingFields = requiredFields.filter((field) => !columnIndexes.has(field));
  if (missingFields.length > 0) {
    return {
      rows: [],
      errors: [`필수 열이 없습니다: ${missingFields.map(field => fieldLabels[field]).join(", ")}. 양식을 내려받아 작성해 주세요.`],
    };
  }

  const parsedRows: ParsedContactSpreadsheetRow[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((cells, rowOffset) => {
    if (cells.every(cell => !normalizeCell(cell))) return;
    const lineNumber = rowOffset + 2;
    const value = (field: keyof ParsedContactSpreadsheetRow) =>
      (columnIndexes.has(field) ? normalizeCell(cells[columnIndexes.get(field)!]) : "");
    const row: ParsedContactSpreadsheetRow = {
      nameKo: value("nameKo"),
      nameEn: value("nameEn"),
      departmentKo: value("departmentKo"),
      departmentEn: value("departmentEn"),
      roleKo: value("roleKo"),
      roleEn: value("roleEn"),
      studentNumber: value("studentNumber"),
      email: value("email"),
      phoneNumber: value("phoneNumber").replace(/-/g, ""),
      privacyConsented: true,
    };

    const missing = requiredFields.filter((field) => !row[field]);
    if (missing.length > 0) {
      errors.push(`${lineNumber}행: ${missing.map(field => fieldLabels[field]).join(", ")}을 입력해 주세요.`);
      return;
    }
    if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) {
      errors.push(`${lineNumber}행: 이메일 형식이 올바르지 않습니다.`);
      return;
    }

    parsedRows.push(row);
  });

  return { rows: parsedRows, errors };
}

export const CONTACT_XLSX_TEMPLATE_ROWS = [
  ["이름", "학번", "부서", "직책", "이메일", "전화번호"],
  ["홍길동", "20261234", "전산관리부", "부원", "hong@example.com", "01012345678"],
] as const;
