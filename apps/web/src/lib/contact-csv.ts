export interface ParsedContactCsvRow {
  nameKo: string;
  nameEn: string;
  roleKo: string;
  roleEn: string;
  email: string;
  phoneNumber: string;
  sortOrder?: number;
}

export interface ContactCsvParseResult {
  rows: ParsedContactCsvRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<keyof ParsedContactCsvRow, string[]> = {
  nameKo: ["nameko", "이름", "이름(한글)", "이름(국문)"],
  nameEn: ["nameen", "영문이름", "이름(영문)", "이름(영문)"],
  roleKo: ["roleko", "직책", "역할", "직책(한글)", "역할(한글)"],
  roleEn: ["roleen", "영문직책", "직책(영문)", "역할(영문)"],
  email: ["email", "이메일", "메일"],
  phoneNumber: ["phonenumber", "phone", "전화번호", "연락처", "휴대전화"],
  sortOrder: ["sortorder", "순서", "정렬순서"],
};

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

export function parseContactCsv(input: string): ContactCsvParseResult {
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["헤더를 포함한 연락망 CSV 파일을 선택해 주세요."] };
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const columnIndexes = new Map<keyof ParsedContactCsvRow, number>();

  (Object.keys(HEADER_ALIASES) as Array<keyof ParsedContactCsvRow>).forEach(
    (field) => {
      const index = headerCells.findIndex((header) =>
        HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === header),
      );
      if (index >= 0) columnIndexes.set(field, index);
    },
  );

  const requiredFields: Array<keyof ParsedContactCsvRow> = [
    "nameKo",
    "nameEn",
    "roleKo",
    "roleEn",
  ];
  const missingFields = requiredFields.filter((field) => !columnIndexes.has(field));
  if (missingFields.length > 0) {
    return {
      rows: [],
      errors: [
        `필수 열이 없습니다: ${missingFields.join(", ")}. 예시 헤더는 nameKo,nameEn,roleKo,roleEn,email,phoneNumber,sortOrder 입니다.`,
      ],
    };
  }

  const rows: ParsedContactCsvRow[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, lineOffset) => {
    const lineNumber = lineOffset + 2;
    const cells = parseCsvLine(line);
    const value = (field: keyof ParsedContactCsvRow) =>
      (columnIndexes.has(field) ? cells[columnIndexes.get(field)!] ?? "" : "").trim();
    const row = {
      nameKo: value("nameKo"),
      nameEn: value("nameEn"),
      roleKo: value("roleKo"),
      roleEn: value("roleEn"),
      email: value("email"),
      phoneNumber: value("phoneNumber"),
      sortOrder: value("sortOrder") ? Number(value("sortOrder")) : undefined,
    } satisfies ParsedContactCsvRow;

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
      errors.push(`${lineNumber}행: sortOrder는 정수여야 합니다.`);
      return;
    }

    rows.push(row);
  });

  return { rows, errors };
}

export const CONTACT_CSV_TEMPLATE =
  "nameKo,nameEn,roleKo,roleEn,email,phoneNumber,sortOrder\n홍길동,Gildong Hong,회장,President,hong@example.com,010-0000-0000,10\n";
