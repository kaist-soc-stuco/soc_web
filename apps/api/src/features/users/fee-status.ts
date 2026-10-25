import type { FeeStatus } from "@soc/contracts";
import { sql, type SQL } from "drizzle-orm";
import { studentFeePayments, studentFeeStatus, users } from "../../infrastructure/postgres/postgres.schema";
import { resolveFeeReferenceSemester } from "./fee-semester";

/** Requires users and studentFeeStatus in scope; preserves undated legacy grants. */
export function effectiveFeeStatusSql(referenceSemester = resolveFeeReferenceSemester()): SQL<FeeStatus> {
  const reference = Number(referenceSemester.slice(0, 4)) * 2 + Number(referenceSemester.at(-1)) - 1;
  const paymentStart = sql`CASE WHEN ${studentFeePayments.effectiveStartSemester} ~ '^[0-9]{4}-[12]$'
    THEN split_part(${studentFeePayments.effectiveStartSemester}, '-', 1)::int * 2
      + split_part(${studentFeePayments.effectiveStartSemester}, '-', 2)::int - 1 END`;
  const legacyStart = sql`extract(year from ${studentFeeStatus.paidAt} at time zone 'UTC')::int * 2
    + CASE WHEN extract(month from ${studentFeeStatus.paidAt} at time zone 'UTC') < 7 THEN 0 ELSE 1 END`;
  const legacyActive = sql`(${studentFeeStatus.paidAt} IS NULL OR
    (${reference} >= ${legacyStart} AND ${reference} < ${legacyStart} + greatest(1, coalesce(${studentFeeStatus.coverageSemesters}, 6))))`;
  return sql<FeeStatus>`CASE WHEN EXISTS (
    SELECT 1 FROM ${studentFeePayments} WHERE ${studentFeePayments.userId} = ${users.userId}
      AND ${reference} >= ${paymentStart}
      AND ${reference} < ${paymentStart} + greatest(1, ${studentFeePayments.coverageSemesters})
    ) OR (${studentFeeStatus.status} = 'PAID' AND ${legacyActive}) THEN 'PAID'
    WHEN ${studentFeeStatus.status} = 'PARTIAL' AND ${studentFeeStatus.paidAmount} > 0 AND ${legacyActive} THEN 'PARTIAL'
    ELSE 'UNPAID' END`;
}
