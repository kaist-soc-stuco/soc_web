import * as XLSX from "xlsx";
import {
  getRoadmapLegacyCourseCode,
  normalizeRoadmapCourseCode,
} from "@soc/contracts";

export interface RoadmapImportRow {
  capacity: number | null;
  courseCode: string;
  legacyCourseCode: string | null;
  credits: string | null;
  currentCode: string;
  delivery: string | null;
  enrolled: number | null;
  inEnglish: boolean;
  instructor: string | null;
  nameKo: string;
  room: string | null;
  section: string | null;
  sourceData: Record<string, unknown>;
  term: string;
  time: string | null;
}

export interface RoadmapImportResult {
  rows: RoadmapImportRow[];
  skippedCount: number;
  warnings: string[];
}

const MAX_IMPORT_ROWS = 5_000;

const FIELD_ALIASES = {
  academicYear: ["개설년도", "개설 연도"],
  semester: ["개설학기", "개설 학기"],
  department: ["개설학과", "개설 학과"],
  courseType: ["과정구분", "과정 구분"],
  subjectType: ["과목구분", "과목 구분"],
  currentCode: ["교과목코드", "교과목 코드"],
  nameKo: ["교과목명", "교과목 명"],
  section: ["분반"],
  oldCode: ["과거 과목번호", "과거과목번호"],
  credits: ["강 : 실 : 학", "강:실:학", "강실학"],
  instructor: ["담당교수", "담당 교수"],
  english: ["영어"],
  capacity: ["정원"],
  enrolled: ["수강인원", "수강 인원"],
  time: ["강의시간", "강의 시간"],
  room: ["강의실", "강의 실"],
  delivery: ["강의유형", "강의 유형", "강의 방식"],
} as const;

const REQUIRED_FIELDS = [
  "academicYear",
  "semester",
  "department",
  "courseType",
  "subjectType",
  "nameKo",
] as const;

const RESEARCH_COURSE_PATTERN = /연구/;

const COURSE_CODE_BY_NAME: Record<string, string> = {
  인공지능개론: "CS40700",
  컴퓨터비전개론: "CS30705",
};

type SpreadsheetRow = Record<string, unknown>;

export function parseRoadmapWorkbook(
  buffer: Buffer,
  sourceFileName: string,
): RoadmapImportResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      cellDates: false,
      dense: false,
      raw: true,
      type: "buffer",
      WTF: true,
    });
  } catch {
    throw new Error("roadmap_workbook_unreadable");
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("roadmap_workbook_empty");
  }

  const accepted: RoadmapImportRow[] = [];
  const skippedReasons = new Map<string, number>();
  let skippedCount = 0;
  let scannedRows = 0;
  let hasValidSheet = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, {
      blankrows: false,
      defval: null,
      raw: true,
    });
    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0] ?? {});
    const missingFields: string[] = REQUIRED_FIELDS.filter(
      (field) => !findHeader(headers, FIELD_ALIASES[field]),
    );
    if (
      !findHeader(headers, FIELD_ALIASES.currentCode) &&
      !findHeader(headers, FIELD_ALIASES.oldCode)
    ) {
      missingFields.push("currentCode");
    }
    if (missingFields.length > 0) {
      addSkipped(skippedReasons, `필수 컬럼 누락(${missingFields.join(", ")})`, rows.length);
      skippedCount += rows.length;
      continue;
    }

    hasValidSheet = true;
    for (const [index, row] of rows.entries()) {
      scannedRows += 1;
      if (scannedRows > MAX_IMPORT_ROWS) {
        throw new Error("roadmap_import_too_many_rows");
      }

      const nameKo = normalizeText(readField(row, FIELD_ALIASES.nameKo));
      const currentCode = normalizeCode(readField(row, FIELD_ALIASES.currentCode));
      const oldCode = normalizeCode(readField(row, FIELD_ALIASES.oldCode));
      const department = normalizeText(readField(row, FIELD_ALIASES.department));
      const courseType = normalizeText(readField(row, FIELD_ALIASES.courseType));
      const subjectType = normalizeText(readField(row, FIELD_ALIASES.subjectType));

      if (!nameKo || (!currentCode && !oldCode)) {
        addSkipped(skippedReasons, "과목번호 또는 과목명 없음");
        skippedCount += 1;
        continue;
      }
      if (department !== "전산학부") {
        addSkipped(skippedReasons, "개설학과가 전산학부가 아님");
        skippedCount += 1;
        continue;
      }
      if (courseType !== "학사과정") {
        addSkipped(skippedReasons, "학사과정이 아님");
        skippedCount += 1;
        continue;
      }
      if (RESEARCH_COURSE_PATTERN.test(subjectType) || RESEARCH_COURSE_PATTERN.test(nameKo)) {
        addSkipped(skippedReasons, "연구 과목");
        skippedCount += 1;
        continue;
      }

      const term = parseTerm(
        readField(row, FIELD_ALIASES.academicYear),
        readField(row, FIELD_ALIASES.semester),
      );
      if (!term) {
        addSkipped(skippedReasons, "학기 정보 없음");
        skippedCount += 1;
        continue;
      }

      // The current KAIST code is authoritative. Older 3-digit numbers are
      // aliases only; using them as the primary key creates duplicate courses
      // when the same workbook also contains the new code.
      const canonicalCourseCode = normalizeRoadmapCourseCode(
        currentCode || COURSE_CODE_BY_NAME[nameKo] || oldCode,
      );
      const sourceData = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, normalizeRawValue(value)]),
      );
      sourceData.__sourceSheet = sheetName;
      sourceData.__sourceRow = index + 2;
      sourceData.__sourceFile = sourceFileName;

      accepted.push({
        capacity: parseInteger(readField(row, FIELD_ALIASES.capacity)),
        courseCode: canonicalCourseCode,
        legacyCourseCode: oldCode || getRoadmapLegacyCourseCode(canonicalCourseCode),
        credits: normalizeCredits(readField(row, FIELD_ALIASES.credits)),
        currentCode: currentCode || canonicalCourseCode,
        delivery: normalizeNullableText(readField(row, FIELD_ALIASES.delivery)),
        enrolled: parseInteger(readField(row, FIELD_ALIASES.enrolled)),
        inEnglish: parseBoolean(readField(row, FIELD_ALIASES.english)),
        instructor: normalizeNullableText(readField(row, FIELD_ALIASES.instructor)),
        nameKo,
        room: normalizeNullableText(readField(row, FIELD_ALIASES.room)),
        section: normalizeNullableText(readField(row, FIELD_ALIASES.section)),
        sourceData,
        term,
        time: normalizeNullableText(readField(row, FIELD_ALIASES.time)),
      });
    }
  }

  if (!hasValidSheet) {
    throw new Error("roadmap_workbook_headers_invalid");
  }
  if (accepted.length === 0) {
    throw new Error("roadmap_import_no_eligible_rows");
  }

  const warnings = [...skippedReasons.entries()]
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}: ${count}개 행 제외`);

  return {
    rows: accepted,
    skippedCount,
    warnings,
  };
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, "").replace(/[():/·]/g, "").toLocaleLowerCase();
}

function findHeader(headers: string[], aliases: readonly string[]): string | undefined {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  return aliases.map(normalizeHeader).map((alias) => normalizedHeaders.get(alias)).find(Boolean);
}

function readField(row: SpreadsheetRow, aliases: readonly string[]): unknown {
  const header = findHeader(Object.keys(row), aliases);
  return header ? row[header] : null;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "").toLocaleUpperCase();
}

function parseTerm(yearValue: unknown, semesterValue: unknown): string | null {
  const yearText = normalizeText(yearValue);
  const yearMatch = yearText.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : Number(yearText);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;

  const semester = normalizeText(semesterValue).toLocaleLowerCase();
  if (semester.includes("봄") || semester.includes("spring") || semester === "1학기") {
    return `${year}-spring`;
  }
  if (semester.includes("가을") || semester.includes("fall") || semester === "2학기") {
    return `${year}-fall`;
  }
  return null;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const numeric = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isInteger(numeric) ? numeric : null;
}

function parseBoolean(value: unknown): boolean {
  return ["y", "yes", "true", "1", "예", "네"].includes(
    normalizeText(value).toLocaleLowerCase(),
  );
}

function normalizeCredits(value: unknown): string | null {
  const text = normalizeNullableText(value);
  if (!text) return null;

  return text
    .split(":")
    .map((part) => {
      const numeric = Number(part);
      return Number.isFinite(numeric) && Number.isInteger(numeric)
        ? String(numeric)
        : part.trim();
    })
    .join(":");
}

function normalizeRawValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value === undefined) return null;
  return value;
}

function addSkipped(reasons: Map<string, number>, reason: string, count = 1): void {
  reasons.set(reason, (reasons.get(reason) ?? 0) + count);
}
