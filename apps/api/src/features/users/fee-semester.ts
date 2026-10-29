import { msToDate, nowDate } from "@soc/shared";

const FEE_REFERENCE_SEMESTER_PATTERN = /^\d{4}-[12]$/;

export function resolveFeeReferenceSemester(value?: string | null): string {
  if (value && FEE_REFERENCE_SEMESTER_PATTERN.test(value)) return value;

  const now = msToDate(nowDate().valueOf() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${now.getUTCMonth() < 6 ? 1 : 2}`;
}
