import { readFileSync } from "node:fs";
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

/** Private deployment data is mounted separately from source and images. */
export function getStudentFeeBootstrap(
  stdNo: string | null | undefined,
): StudentFeeBootstrapRecord | null {
  const filePath = process.env.STUDENT_FEE_BOOTSTRAP_PATH?.trim();
  const normalized = stdNo?.trim();
  if (!filePath || !normalized) return null;

  if (cachedPath !== filePath) {
    try {
      const records = z.array(BootstrapRecordSchema).parse(
        JSON.parse(readFileSync(filePath, "utf8")),
      );
      cachedRecords = new Map(records.map((record) => [record.stdNo, record]));
      cachedPath = filePath;
    } catch {
      throw new Error("student_fee_bootstrap_file_invalid");
    }
  }
  return cachedRecords.get(normalized) ?? null;
}
