import { readFileSync } from "node:fs";
import { Logger } from "@nestjs/common";
import { nowMs } from "@soc/shared";
import { z } from "zod";

export const BootstrapRecordSchema = z.object({
  stdNo: z.string().regex(/^\d{8}$/),
  nameKo: z.string().trim().min(1).max(100).optional(),
  admissionYear: z.number().int().nullable(),
  paidSemesters: z.number().int().min(0).max(32767),
  paidAmount: z.number().int().min(0).max(2147483647),
});

export const BootstrapRecordsSchema = z.array(BootstrapRecordSchema).superRefine((records, context) => {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.stdNo)) context.addIssue({ code: "custom", message: "duplicate_student_number", path: [index, "stdNo"] });
    seen.add(record.stdNo);
  });
});

// This private source is a 2024/2025 balance snapshot. Its original total must
// stay fixed even when the current fee policy changes.
export const BOOTSTRAP_BALANCE_REFERENCE_AMOUNT = 30_000;
export const DepartmentFeePaymentsSchema = z.array(z.object({
  stdNo: z.string().trim().regex(/^\d{8}$/),
  nameKo: z.string().trim().min(1).max(100).nullish(),
  remainingAmount: z.number().int().min(0).max(BOOTSTRAP_BALANCE_REFERENCE_AMOUNT),
})).superRefine((records, context) => {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.stdNo)) context.addIssue({ code: "custom", message: "duplicate_student_number", path: [index, "stdNo"] });
    seen.add(record.stdNo);
  });
});

export type StudentFeeBootstrapRecord = z.infer<typeof BootstrapRecordSchema>;

/** Keep historical completion; only outstanding accounts owe today's difference. */
export function parseStudentFeeBootstrapRecords(input: unknown): StudentFeeBootstrapRecord[] {
  const isBalanceSnapshot = Array.isArray(input) && input.some(record =>
    record !== null && typeof record === "object" && "remainingAmount" in record,
  );
  if (!isBalanceSnapshot) return BootstrapRecordsSchema.parse(input);

  return DepartmentFeePaymentsSchema.parse(input).map(record => ({
    stdNo: record.stdNo,
    ...(record.nameKo ? { nameKo: record.nameKo } : {}),
    admissionYear: Number(record.stdNo.slice(0, 4)),
    // A zero balance proves completion. Do not invent semester counts for
    // partial payers: their credited amount, rather than duration, drives debt.
    paidSemesters: record.remainingAmount === 0 ? 6 : 0,
    paidAmount: BOOTSTRAP_BALANCE_REFERENCE_AMOUNT - record.remainingAmount,
  }));
}

let cachedPath: string | undefined;
let cachedRecords = new Map<string, StudentFeeBootstrapRecord>();
let refreshAfter = 0;
let cachedAvailable = false;
const REFRESH_INTERVAL_MS = 60_000;
const logger = new Logger("StudentFeeBootstrap");

/** Private deployment data is mounted separately from source and images. */
export function getStudentFeeBootstrap(
  stdNo: string | null | undefined,
): StudentFeeBootstrapRecord | null {
  const normalized = stdNo?.trim();
  if (!normalized || !/^\d{8}$/.test(normalized)) return null;
  if (!getStudentFeeBootstrapRecords()) return null;
  return cachedRecords.get(normalized) ?? null;
}

/** Validate the whole file before any record can reach the database. */
export function getStudentFeeBootstrapRecords(): StudentFeeBootstrapRecord[] | null {
  const filePath = process.env.STUDENT_FEE_BOOTSTRAP_PATH?.trim();
  if (!filePath) return null;

  const now = nowMs();
  if (cachedPath !== filePath || now >= refreshAfter) {
    // Never reuse a different or previously valid file after a failed refresh.
    cachedPath = filePath;
    cachedRecords = new Map();
    cachedAvailable = false;
    refreshAfter = now + REFRESH_INTERVAL_MS;
    try {
      const records = parseStudentFeeBootstrapRecords(
        JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")),
      );
      cachedRecords = new Map(records.map((record) => [record.stdNo, record]));
      cachedAvailable = true;
    } catch (error) {
      // This is optional import data, not proof required to authenticate. Leave
      // existing fee records untouched and retry after the file is repaired.
      // Do not log the file contents, student number, or parser exception.
      const duplicateRows = error instanceof z.ZodError
        ? error.issues.filter(issue => issue.message === "duplicate_student_number").length
        : 0;
      logger.warn(duplicateRows
        ? `student_fee_bootstrap_invalid: duplicate_student_number; duplicateRows=${duplicateRows}; no fee records imported. Correct the source file and restart the API.`
        : "student_fee_bootstrap_unavailable: file missing or invalid; fee import skipped; login can continue.");
    }
  }
  return cachedAvailable ? [...cachedRecords.values()] : null;
}
