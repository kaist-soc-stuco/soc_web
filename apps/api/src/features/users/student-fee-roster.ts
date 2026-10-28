import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { FeeStatus } from "@soc/contracts";
import { studentFeePayments, studentFeeStatus } from "../../infrastructure/postgres/schema/fee.schema";

export const INITIAL_FEE_ROSTER_NOTE = "초기 과비 납부 명부 연계";
const PREVIOUS_BOOTSTRAP_NOTE = "과비 실자료 정리본 기준 최초 로그인 자동 반영";

export function initialFeeRosterStatus(paidSemesters: number): FeeStatus {
  return paidSemesters >= 6 ? "PAID" : paidSemesters > 0 ? "PARTIAL" : "UNPAID";
}

/** Initial linkage must never replace verified changes or payment transactions. */
export function initialFeeRosterLinkAllowed() {
  return and(
    isNull(studentFeeStatus.paidAt), isNull(studentFeeStatus.verifiedBy), isNull(studentFeeStatus.verifiedAt),
    or(
      and(eq(studentFeeStatus.status, "UNPAID"), eq(studentFeeStatus.coverageSemesters, 6), eq(studentFeeStatus.paidAmount, 0), isNull(studentFeeStatus.note)),
      inArray(studentFeeStatus.note, [INITIAL_FEE_ROSTER_NOTE, PREVIOUS_BOOTSTRAP_NOTE]),
    ),
    sql`NOT EXISTS (SELECT 1 FROM ${studentFeePayments} WHERE ${studentFeePayments.userId} = ${studentFeeStatus.userId})`,
  );
}
