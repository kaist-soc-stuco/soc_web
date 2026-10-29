import { SaveStudentFeeRosterSchema, type StudentFeeRosterRecord, type StudentFeeRosterUpdate } from "@soc/contracts";
import * as XLSX from "xlsx";

export interface FeeRosterRow {
  key: string;
  stdNo: string;
  nameKo: string;
  admissionYear: string;
  paidSemesters: string;
  paidAmount: string;
  note: string;
  userId: string | null;
  joinedAt: string | null;
  updatedAt: string | null;
  totalPaidAmount?: number;
  requiredAmount?: number;
  remainingAmount?: number;
  status?: "PAID" | "PARTIAL" | "UNPAID";
  email?: string;
  paidAt?: string | null;
}

export function feeRosterRow(record: StudentFeeRosterRecord): FeeRosterRow {
  return { ...record, key: record.userId ?? record.stdNo, nameKo: record.nameKo ?? "", admissionYear: record.admissionYear?.toString() ?? "",
    paidSemesters: String(record.paidSemesters), paidAmount: String(record.paidAmount), note: record.note ?? "" };
}

export function feeRosterUpdate(row: FeeRosterRow): StudentFeeRosterUpdate {
  const integer = (value: string) => /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value.trim()) ? Number(value.trim().replaceAll(",", "")) : Number.NaN;
  return { stdNo: row.stdNo.trim(), nameKo: row.nameKo.trim() || null, admissionYear: row.admissionYear.trim() ? integer(row.admissionYear) : null,
    paidSemesters: integer(row.paidSemesters), paidAmount: integer(row.paidAmount), note: row.note.trim() || null, expectedUpdatedAt: row.updatedAt };
}

/** Tab-separated cells from Excel/Sheets, including quoted tabs and newlines. */
export function pasteFeeRoster(text: string, current: FeeRosterRow[]): FeeRosterRow[] {
  if (text.length > 2_000_000) throw new Error("한 번에 2,000행까지 붙여넣을 수 있습니다.");
  const book = XLSX.read(text, { type: "string", raw: true, FS: "\t" });
  const data = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", raw: false });
  return applyFeeRosterCells(data, current);
}

export function importFeeRoster(input: ArrayBuffer, current: FeeRosterRow[]): FeeRosterRow[] {
  const book = XLSX.read(input, { type: "array", raw: true });
  if (!book.SheetNames[0]) throw new Error("명부 시트가 없습니다.");
  const cells = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", raw: false });
  return applyFeeRosterCells(cells, current);
}

function applyFeeRosterCells(data: string[][], current: FeeRosterRow[]): FeeRosterRow[] {
  const hasHeader = data[0]?.[0]?.trim() === "학번";
  const cells = (hasHeader ? data.slice(1) : data).filter(row => row.some(cell => String(cell).trim()));
  if (!cells.length || cells.length > 2000) throw new Error("1~2,000행을 붙여넣어 주세요.");
  const seen = new Set<string>();
  const byNumber = new Map(current.map(row => [row.stdNo, row]));
  const pasted = cells.map((cells, index) => {
    const stdNo = String(cells[0] ?? "").trim();
    if (!/^\d{8}$/.test(stdNo) || seen.has(stdNo)) throw new Error(`${index + 1}행의 학번을 확인해 주세요. 중복 학번은 사용할 수 없습니다.`);
    seen.add(stdNo);
    const existing = byNumber.get(stdNo);
    const row: FeeRosterRow = existing ? { ...existing } : { key: stdNo, stdNo, nameKo: "", admissionYear: "", paidSemesters: "0", paidAmount: "0", note: "", userId: null, joinedAt: null, updatedAt: null };
    for (const [offset, field] of ["stdNo", "nameKo", "admissionYear", "paidSemesters", "paidAmount", "note"].entries()) {
      if (cells[offset] !== undefined) Object.assign(row, { [field]: String(cells[offset]) });
    }
    return row;
  });
  const parsed = SaveStudentFeeRosterSchema.safeParse({ records: pasted.map(feeRosterUpdate) });
  if (!parsed.success) throw new Error("학번·입학 연도·납부 학기 수·납부 금액을 확인해 주세요. 금액과 학기 수는 0 이상의 정수여야 합니다.");
  return [...pasted, ...current.filter(row => !seen.has(row.stdNo))];
}
