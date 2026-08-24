import * as XLSX from "xlsx";

export interface ParsedContactSpreadsheetRow {
  nameKo: string;
  nameEn: string;
  departmentKo: string;
  departmentEn: string;
  roleKo: string;
  roleEn: string;
  gender: string;
  cohort?: number;
  email: string;
  phoneNumber: string;
  privacyConsented: boolean;
  sortOrder?: number;
}

export interface ContactSpreadsheetParseResult {
  rows: ParsedContactSpreadsheetRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<keyof ParsedContactSpreadsheetRow, string[]> = {
  nameKo: ["nameko", "이름", "이름(한글)", "이름(국문)"],
  nameEn: ["nameen", "영문이름", "이름(영문)"],
  departmentKo: ["departmentko", "부서", "부서(한글)", "부서(국문)"],
  departmentEn: ["departmenten", "영문부서", "부서(영문)"],
  roleKo: ["roleko", "직책", "역할", "직책(한글)", "역할(한글)"],
  roleEn: ["roleen", "영문직책", "직책(영문)", "역할(영문)"],
  gender: ["gender", "성별"],
  cohort: ["cohort", "기수"],
  email: ["email", "이메일", "메일"],
  phoneNumber: ["phonenumber", "phone", "전화번호", "연락처", "휴대전화"],
  privacyConsented: ["privacyconsented", "개인정보동의", "동의여부"],
  sortOrder: ["sortorder", "순서", "정렬순서"],
};

const requiredFields: Array<keyof ParsedContactSpreadsheetRow> = [
  "nameKo",
  "nameEn",
  "roleKo",
  "roleEn",
];

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
  (Object.keys(HEADER_ALIASES) as Array<keyof ParsedContactSpreadsheetRow>).forEach((field) => {
    const index = headerCells.findIndex((header) =>
      HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === header),
    );
    if (index >= 0) columnIndexes.set(field, index);
  });

  const missingFields = requiredFields.filter((field) => !columnIndexes.has(field));
  if (missingFields.length > 0) {
    return {
      rows: [],
      errors: [`필수 열이 없습니다: ${missingFields.join(", ")}. XLSX 양식을 먼저 내보내 사용할 수 있습니다.`],
    };
  }

  const parsedRows: ParsedContactSpreadsheetRow[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((cells, rowOffset) => {
    const lineNumber = rowOffset + 2;
    const value = (field: keyof ParsedContactSpreadsheetRow) =>
      (columnIndexes.has(field) ? normalizeCell(cells[columnIndexes.get(field)!]) : "");
    const cohortText = value("cohort");
    const sortOrderText = value("sortOrder");
    const row = {
      nameKo: value("nameKo"),
      nameEn: value("nameEn"),
      departmentKo: value("departmentKo"),
      departmentEn: value("departmentEn"),
      roleKo: value("roleKo"),
      roleEn: value("roleEn"),
      gender: value("gender"),
      cohort: cohortText ? Number(cohortText) : undefined,
      email: value("email"),
      phoneNumber: value("phoneNumber"),
      privacyConsented: value("privacyConsented")
        ? !["false", "0", "no", "아니오", "미동의"].includes(value("privacyConsented").toLowerCase())
        : true,
      sortOrder: sortOrderText ? Number(sortOrderText) : undefined,
    } satisfies ParsedContactSpreadsheetRow;

    const missing = requiredFields.filter((field) => !row[field]);
    if (missing.length > 0) {
      errors.push(`${lineNumber}행: ${missing.join(", ")} 값이 비어 있습니다.`);
      return;
    }
    if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) {
      errors.push(`${lineNumber}행: 이메일 형식이 올바르지 않습니다.`);
      return;
    }
    if (row.sortOrder !== undefined && !Number.isInteger(row.sortOrder)) {
      errors.push(`${lineNumber}행: 표시순서는 정수여야 합니다.`);
      return;
    }
    if (row.cohort !== undefined && (!Number.isInteger(row.cohort) || row.cohort < 1)) {
      errors.push(`${lineNumber}행: 기수는 1 이상의 정수여야 합니다.`);
      return;
    }

    parsedRows.push(row);
  });

  return { rows: parsedRows, errors };
}

export const CONTACT_XLSX_TEMPLATE_ROWS = [
  ["이름", "영문명", "부서", "영문부서", "직책", "영문직책", "성별", "기수", "이메일", "전화번호", "개인정보동의", "표시순서"],
  ["홍길동", "Gildong Hong", "회장단", "Presidium", "회장", "President", "남", 26, "hong@example.com", "010-0000-0000", "동의", 10],
] as const;
