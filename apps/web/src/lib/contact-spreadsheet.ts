import * as XLSX from "xlsx";
import { ContactImportItemSchema, type ContactActivity } from "@soc/contracts";
import { msToTimeObj, nowMs } from "@soc/shared";

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
  activities?: ContactActivity[];
  cohort?: number;
}

export interface ContactSpreadsheetParseResult {
  rows: ParsedContactSpreadsheetRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<Exclude<keyof ParsedContactSpreadsheetRow, "privacyConsented" | "activities" | "cohort">, string[]> = {
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

const requiredFields: Array<keyof ParsedContactSpreadsheetRow> = ["nameKo", "studentNumber", "roleKo"];

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
    const sheetName = workbook.Sheets["연락망"] ? "연락망" : workbook.SheetNames[0];
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
  const yearColumns = headerCells.flatMap((header, index) => ["연도", "활동연도", "year"].includes(header) ? [index] : []);
  if (yearColumns.length > 1) return { rows: [], errors: ["중복된 연도 열을 확인해 주세요."] };
  const yearColumn = yearColumns[0];
  const columnIndexes = new Map<keyof ParsedContactSpreadsheetRow, number>();
  const duplicateColumns: string[] = [];
  (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach((field) => {
    const matching = headerCells.flatMap((header, index) => HEADER_ALIASES[field].some(alias => normalizeHeader(alias) === header) ? [index] : []);
    const index = matching[0] ?? -1;
    if (matching.length > 1) duplicateColumns.push(headerCells[index]);
    if (index >= 0) columnIndexes.set(field, index);
  });
  if (duplicateColumns.length) return { rows: [], errors: [`중복된 열 제목을 확인해 주세요: ${duplicateColumns.join(", ")}`] };

  const fieldLabels: Partial<Record<keyof ParsedContactSpreadsheetRow, string>> = { nameKo: "이름", studentNumber: "학번", roleKo: "직책" };
  const missingFields = requiredFields.filter((field) => !columnIndexes.has(field));
  if (missingFields.length > 0) {
    return {
      rows: [],
      errors: [`필수 열이 없습니다: ${missingFields.map(field => fieldLabels[field]).join(", ")}. 양식을 내려받아 작성해 주세요.`],
    };
  }

  const parsedRows: ParsedContactSpreadsheetRow[] = [];
  const errors: string[] = [];
  let recordCount = 0;
  const studentRows = new Map<string, number>();
  const students = new Map<string, ParsedContactSpreadsheetRow>();

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
    if (row.nameKo === "홍길동(예시)" && row.studentNumber === "20260000" && row.email === "example@example.invalid") return;
    recordCount++;

    const missing = requiredFields.filter((field) => !row[field]);
    if (missing.length > 0) {
      errors.push(`${lineNumber}행: ${missing.map(field => fieldLabels[field]).join(", ")}을 입력해 주세요.`);
      return;
    }
    if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) {
      errors.push(`${lineNumber}행: 이메일 형식이 올바르지 않습니다.`);
      return;
    }
    if (/^10\d{8}$/.test(row.phoneNumber)) {
      errors.push(`${lineNumber}행: 전화번호 앞의 0이 빠졌는지 확인해 주세요. 텍스트 서식으로 다시 입력해 주세요.`);
      return;
    }
    const validated = ContactImportItemSchema.safeParse(row);
    if (!validated.success) {
      const labels: Partial<Record<keyof ParsedContactSpreadsheetRow, string>> = {
        nameKo: "이름(100자 이내)", nameEn: "영문 이름(100자 이내)", departmentKo: "부서(100자 이내)",
        departmentEn: "영문 부서(100자 이내)", roleKo: "직책(100자 이내)", roleEn: "영문 직책(100자 이내)",
        studentNumber: "학번(8자리)", email: "이메일", phoneNumber: "전화번호(50자 이내)",
      };
      errors.push(`${lineNumber}행: ${labels[validated.error.issues[0].path[0] as keyof ParsedContactSpreadsheetRow] ?? "입력값"}을 확인해 주세요.`);
      return;
    }
    if (yearColumn !== undefined) {
      const yearText = normalizeCell(cells[yearColumn]);
      const year = yearText ? Number(yearText) : msToTimeObj(nowMs()).year;
      if (!/^\d{4}$/.test(String(year)) || year < 1900 || year > 3000) {
        errors.push(`${lineNumber}행: 연도(1900~3000년)를 확인해 주세요.`);
        return;
      }
      row.cohort = year;
      row.activities = [{ year, departmentKo: row.departmentKo, departmentEn: row.departmentEn, roleKo: row.roleKo, roleEn: row.roleEn }];
    }
    const previous = students.get(row.studentNumber);
    if (previous && yearColumn === undefined) {
      errors.push(`${lineNumber}행: ${studentRows.get(row.studentNumber)}행과 학번이 중복됩니다. 학번당 한 행만 입력해 주세요.`);
      return;
    }
    if (previous) {
      const personalFields = ["nameKo", "nameEn", "email", "phoneNumber"] as const;
      if (personalFields.some(field => previous[field] && row[field] && previous[field] !== row[field])) {
        errors.push(`${lineNumber}행: 같은 학번의 이름·이메일·전화번호가 서로 다릅니다. ${studentRows.get(row.studentNumber)}행과 맞춰 주세요.`);
        return;
      }
      const activity = row.activities![0];
      if (previous.activities!.some(entry => entry.year === activity.year && entry.departmentKo === activity.departmentKo && entry.roleKo === activity.roleKo)) {
        errors.push(`${lineNumber}행: 같은 학번의 연도·부서·직책이 중복됩니다.`);
        return;
      }
      for (const field of personalFields) previous[field] ||= row[field];
      previous.activities!.push(activity);
      if (activity.year >= previous.cohort!) {
        for (const field of ["departmentKo", "departmentEn", "roleKo", "roleEn"] as const) previous[field] = row[field];
        previous.cohort = activity.year;
      }
      return;
    }
    studentRows.set(row.studentNumber, lineNumber);
    students.set(row.studentNumber, row);

    parsedRows.push(row);
  });

  if (parsedRows.length > 500 || recordCount > 50000) return { rows: [], errors: ["한 번에 최대 500명까지 가져올 수 있습니다."] };
  if (parsedRows.some(row => (row.activities?.length ?? 0) > 100)) errors.push("한 부원의 활동 이력은 최대 100건까지 입력할 수 있습니다.");
  if (!parsedRows.length && !errors.length) errors.push("예시를 제외한 실제 부원 정보를 1~500명 입력해 주세요.");
  return { rows: parsedRows, errors };
}

export const CONTACT_XLSX_TEMPLATE_ROWS = [
  ["이름", "학번", "부서", "직책", "이메일", "전화번호", "연도"],
  ["홍길동(예시)", "20260000", "전산관리부", "부원", "example@example.invalid", "01012345678", ""],
] as const;

export function createContactTemplate(): Blob {
  const worksheet = XLSX.utils.aoa_to_sheet(CONTACT_XLSX_TEMPLATE_ROWS.map(row => [...row]));
  worksheet["!cols"] = [16, 16, 20, 16, 30, 18, 10].map(wch => ({ wch }));
  for (let row = 1; row <= 501; row++) {
    for (let column = 0; column < 7; column++) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address] ?? { t: "s", v: "" };
      cell.z = "@";
      worksheet[address] = cell;
    }
  }
  worksheet["!ref"] = "A1:G502";
  worksheet["!autofilter"] = { ref: "A1:G502" };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, worksheet, "연락망");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["작성 위치", "2행은 예시로 자동 제외됩니다. 3행부터 실제 부원을 입력하거나 예시를 실제 정보로 바꿔 주세요."],
    ["필수 항목", "이름·학번(8자리)·직책은 필수입니다. 한 번에 최대 500명까지 가져옵니다."],
    ["학번·전화번호", "텍스트 서식입니다. 전화번호 앞의 0이 빠지지 않도록 그대로 입력해 주세요."],
    ["활동 이력", "활동 1건당 한 행에 연도·부서·직책을 입력하세요. 연도가 비어 있으면 올해로 등록됩니다. 같은 학번의 이름·이메일·전화번호는 일치해야 합니다."],
    ["추가·갱신", "같은 학번은 한 부원으로 묶습니다. 파일에 입력한 연도의 활동 이력을 갱신하며, 겸직은 해당 연도의 활동을 모두 입력하세요. 다른 연도와 빈 연락처는 유지됩니다. 이력 삭제는 부원 편집에서 처리하세요."],
  ]), "작성 안내");
  return new Blob([new Uint8Array(XLSX.write(book, { bookType: "xlsx", type: "array" }))], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
