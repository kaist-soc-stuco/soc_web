import type { FeeStatus } from "@soc/contracts";

export const DEFAULT_STUDENT_FEE_AMOUNT = 45_000;
export const STUDENT_FEE_PRIVACY_VERSION = "2026-10-29";

/** Six semesters describe the one-time price, not an entitlement expiry. */
export function resolveStudentFee(input: {
  recognizedComplete: boolean;
  initialAmount: number;
  payments: readonly { amount: number }[];
  requiredAmount: number;
}): { status: FeeStatus; totalPaidAmount: number; requiredAmount: number; remainingAmount: number } {
  const totalPaidAmount = input.initialAmount + input.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const complete = input.recognizedComplete || totalPaidAmount >= input.requiredAmount;
  return {
    status: complete ? "PAID" : totalPaidAmount > 0 ? "PARTIAL" : "UNPAID",
    totalPaidAmount,
    requiredAmount: input.requiredAmount,
    remainingAmount: complete ? 0 : Math.max(0, input.requiredAmount - totalPaidAmount),
  };
}
