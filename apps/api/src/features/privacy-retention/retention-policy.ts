import { BadRequestException } from "@nestjs/common";
import { isoToDate, msToDate } from "@soc/shared";
import { z } from "zod";

export const retentionKinds = ["SURVEY", "APPLICATION", "VOTE", "FEE_PAYMENT", "CONTACT"] as const;
export type RetentionKind = typeof retentionKinds[number];

export const FinalizeRetentionSchema = z.object({
  kind: z.enum(retentionKinds),
  resourceId: z.string().uuid(),
  endedAt: z.string().datetime({ offset: true }),
  settledAt: z.string().datetime({ offset: true }).optional(),
  objectionEndedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type FinalizeRetentionInput = z.infer<typeof FinalizeRetentionSchema>;

export const RetentionHoldSchema = z.object({
  kind: z.enum(retentionKinds),
  resourceId: z.string().uuid(),
  holdUntil: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().trim().min(1).max(300).optional(),
}).strict();

export function shiftCalendarYears(date: Date, years: number): Date {
  const target = msToDate(date.valueOf());
  const month = target.getUTCMonth();
  target.setUTCFullYear(target.getUTCFullYear() + years);
  if (target.getUTCMonth() !== month) target.setUTCDate(0);
  return target;
}

/** Uses the same January–June / July–December semester convention as fee eligibility. */
export function feeCoverageEnd(startSemester: string, semesters: number): Date {
  if (!/^\d{4}-[12]$/.test(startSemester) || !Number.isInteger(semesters) || semesters < 1) {
    throw new BadRequestException("retention_invalid_fee_coverage");
  }
  const last = Number(startSemester.slice(0, 4)) * 2 + Number(startSemester.at(-1)) - 1 + semesters - 1;
  return msToDate(Date.UTC(Math.floor(last / 2), (last % 2 + 1) * 6, 1) - 1);
}

export function retentionDeadline(input: FinalizeRetentionInput, now: Date): { finalizedAt: Date; expiresAt: Date } {
  const endedAt = isoToDate(input.endedAt);
  let finalizedAt = endedAt;
  if (input.kind !== "FEE_PAYMENT" && endedAt > now) throw new BadRequestException("retention_end_in_future");
  if (input.kind === "APPLICATION" || input.kind === "FEE_PAYMENT") {
    if (!input.settledAt) throw new BadRequestException("retention_settlement_required");
    const settledAt = isoToDate(input.settledAt);
    if (settledAt > now) throw new BadRequestException("retention_settlement_in_future");
    finalizedAt = msToDate(Math.max(endedAt.valueOf(), settledAt.valueOf()));
  }
  if (input.kind === "VOTE") {
    if (!input.objectionEndedAt) throw new BadRequestException("retention_objection_end_required");
    const objectionEndedAt = isoToDate(input.objectionEndedAt);
    if (objectionEndedAt > now) throw new BadRequestException("retention_objection_end_in_future");
    finalizedAt = msToDate(Math.max(endedAt.valueOf(), objectionEndedAt.valueOf()));
  }
  const expiresAt = input.kind === "FEE_PAYMENT"
    ? shiftCalendarYears(finalizedAt, 3)
    : msToDate(finalizedAt.valueOf() + 90 * 86_400_000);
  return { finalizedAt, expiresAt };
}

/** Permission administration must survive the ordinary two-year log cutoff. */
export const permissionAuditPattern = "^(role_group[.]|role_group_member[.]|user[.]account[.]|permission[.]|auth[.]initial_admin[.])";
