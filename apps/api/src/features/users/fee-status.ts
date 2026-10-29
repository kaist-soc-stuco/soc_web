import type { FeeStatus } from "@soc/contracts";
import { sql, type SQL } from "drizzle-orm";
import { paidStudentRecords, studentFeePayments, studentFeeStatus, studentFeePolicies, studentFeeConsents, users } from "../../infrastructure/postgres/postgres.schema";
import { resolveFeeReferenceSemester } from "./fee-semester";
import { DEFAULT_STUDENT_FEE_AMOUNT, STUDENT_FEE_PRIVACY_VERSION } from "./fee-policy";

export function currentFeeAmountSql() {
  return sql<number>`coalesce((SELECT ${studentFeePolicies.amount} FROM ${studentFeePolicies}
    WHERE ${studentFeePolicies.effectiveSemester} <= ${resolveFeeReferenceSemester()}
    ORDER BY ${studentFeePolicies.effectiveSemester} DESC, ${studentFeePolicies.createdAt} DESC LIMIT 1), ${DEFAULT_STUDENT_FEE_AMOUNT})`;
}

export function feeTotalPaidSql() {
  const person = sql`(${studentFeePayments.userId} = ${users.userId} OR ${studentFeePayments.stdNo} = ${users.stdNo})`;
  return sql<number>`coalesce((SELECT ${paidStudentRecords.paidAmount} FROM ${paidStudentRecords} WHERE ${paidStudentRecords.stdNo} = ${users.stdNo}),
    CASE WHEN EXISTS (SELECT 1 FROM ${studentFeePayments} WHERE ${person}) THEN coalesce(${studentFeeStatus.initialPaidAmount}, 0)
      ELSE greatest(coalesce(${studentFeeStatus.initialPaidAmount}, 0), coalesce(${studentFeeStatus.paidAmount}, 0)) END, 0)
    + coalesce((SELECT sum(${studentFeePayments.amount}) FROM ${studentFeePayments} WHERE ${person}), 0)`;
}

/** Payment recognition is lifetime; neither a viewing semester nor consent expires it. */
export function effectiveFeeStatusSql(): SQL<FeeStatus> {
  const total = feeTotalPaidSql();
  return sql<FeeStatus>`CASE WHEN ${studentFeeStatus.status} = 'PAID' OR EXISTS (
    SELECT 1 FROM ${paidStudentRecords} WHERE ${paidStudentRecords.stdNo} = ${users.stdNo}
      AND (${paidStudentRecords.completedAt} IS NOT NULL OR ${paidStudentRecords.paidSemesters} >= 6)
    ) OR ${total} >= ${currentFeeAmountSql()} THEN 'PAID'
    WHEN ${total} > 0 THEN 'PARTIAL'
    ELSE 'UNPAID' END`;
}

/** Requires users in scope, independently of the financial status query. */
export function currentFeeConsentSql(semester = resolveFeeReferenceSemester()): SQL<boolean> {
  return sql<boolean>`EXISTS (SELECT 1 FROM ${studentFeeConsents} WHERE ${studentFeeConsents.userId} = ${users.userId}
    AND ${studentFeeConsents.semester} = ${semester} AND ${studentFeeConsents.noticeVersion} = ${STUDENT_FEE_PRIVACY_VERSION}
    AND ${studentFeeConsents.withdrawnAt} IS NULL)`;
}
