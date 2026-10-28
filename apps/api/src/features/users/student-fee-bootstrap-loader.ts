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

export type StudentFeeBootstrapRecord = z.infer<typeof BootstrapRecordSchema>;

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
      const records = BootstrapRecordsSchema.parse(
        JSON.parse(readFileSync(filePath, "utf8")),
      );
      cachedRecords = new Map(records.map((record) => [record.stdNo, record]));
      cachedAvailable = true;
    } catch {
      // This is optional import data, not proof required to authenticate. Leave
      // existing fee records untouched and retry after the file is repaired.
      // Do not log the file contents, student number, or parser exception.
      logger.warn("student_fee_bootstrap_unavailable: skipping fee import; login can continue. Retrying in 60 seconds.");
    }
  }
  return cachedAvailable ? [...cachedRecords.values()] : null;
}
