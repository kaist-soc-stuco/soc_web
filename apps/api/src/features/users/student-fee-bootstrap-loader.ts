import { readFileSync } from "node:fs";
import { Logger } from "@nestjs/common";
import { nowMs } from "@soc/shared";
import { z } from "zod";

const BootstrapRecordSchema = z.object({
  stdNo: z.string().regex(/^\d{8}$/),
  admissionYear: z.number().int().nullable(),
  paidSemesters: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
});

export type StudentFeeBootstrapRecord = z.infer<typeof BootstrapRecordSchema>;

let cachedPath: string | undefined;
let cachedRecords = new Map<string, StudentFeeBootstrapRecord>();
let refreshAfter = 0;
const REFRESH_INTERVAL_MS = 60_000;
const logger = new Logger("StudentFeeBootstrap");

/** Private deployment data is mounted separately from source and images. */
export function getStudentFeeBootstrap(
  stdNo: string | null | undefined,
): StudentFeeBootstrapRecord | null {
  const filePath = process.env.STUDENT_FEE_BOOTSTRAP_PATH?.trim();
  const normalized = stdNo?.trim();
  if (!filePath || !normalized || !/^\d{8}$/.test(normalized)) return null;

  const now = nowMs();
  if (cachedPath !== filePath || now >= refreshAfter) {
    // Never reuse a different or previously valid file after a failed refresh.
    cachedPath = filePath;
    cachedRecords = new Map();
    refreshAfter = now + REFRESH_INTERVAL_MS;
    try {
      const records = z.array(BootstrapRecordSchema).parse(
        JSON.parse(readFileSync(filePath, "utf8")),
      );
      cachedRecords = new Map(records.map((record) => [record.stdNo, record]));
    } catch {
      // This is optional import data, not proof required to authenticate. Leave
      // existing fee records untouched and retry after the file is repaired.
      // Do not log the file contents, student number, or parser exception.
      logger.warn("student_fee_bootstrap_unavailable: skipping fee import; login can continue. Retrying in 60 seconds.");
    }
  }
  return cachedRecords.get(normalized) ?? null;
}
