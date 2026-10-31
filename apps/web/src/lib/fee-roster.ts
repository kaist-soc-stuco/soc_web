import type { StudentFeeRosterRecord, StudentFeeRosterUpdate } from "@soc/contracts";

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
