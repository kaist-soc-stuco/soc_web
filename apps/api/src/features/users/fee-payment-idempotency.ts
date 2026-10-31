import { createHash } from "node:crypto";

import type { BulkProcessStudentFeePaymentsRequest, StudentFeePaymentImportRow } from "@soc/contracts";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    const serialized = entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",");
    return `{${serialized}}`;
  }
  return JSON.stringify(value);
}

/** Canonical hash excludes the idempotency key and preserves payment order. */
export function hashStudentFeePaymentPayload(
  input: BulkProcessStudentFeePaymentsRequest,
  importedEntries?: StudentFeePaymentImportRow[],
): string {
  return createHash("sha256")
    .update(stableJson({ payments: input.payments, importedEntries }), "utf8")
    .digest("hex");
}
