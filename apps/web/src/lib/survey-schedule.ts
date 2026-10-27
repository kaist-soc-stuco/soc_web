import { htmlDatetimeLocalToIso } from "@soc/shared";

/** Draft dates may be incomplete; only the explicit checkbox makes a survey always open. */
export function buildSurveySchedule(values: { isAlwaysOpen?: boolean; isAllDay?: boolean; openAt?: string; closeAt?: string }) {
  const isAlwaysOpen = Boolean(values.isAlwaysOpen);
  const convert = (value: string | undefined, end: boolean) => {
    if (isAlwaysOpen || !value) return null;
    return htmlDatetimeLocalToIso(values.isAllDay && !value.includes("T") ? `${value}T${end ? "23:59" : "00:00"}` : value);
  };
  return { isAlwaysOpen, openAt: convert(values.openAt, false), closeAt: convert(values.closeAt, true) };
}
