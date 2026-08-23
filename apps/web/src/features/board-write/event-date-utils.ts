import {
  htmlDatetimeLocalToIso,
  isoToHtmlDatetimeLocal,
} from "@soc/shared";

function toEventDatetimeLocal(value: string) {
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  ) {
    return value.slice(0, 16);
  }
  return isoToHtmlDatetimeLocal(value);
}

export function eventDateInputToIso(
  value: string,
  isAllDay: boolean,
  endOfDay = false,
) {
  if (!value) return "";

  const datePart = value.slice(0, 10);
  const datetimeValue = isAllDay
    ? `${datePart}T${endOfDay ? "23:59" : "00:00"}`
    : value;
  return htmlDatetimeLocalToIso(datetimeValue);
}

export function isoToEventDateInput(value: string, isAllDay: boolean) {
  const datetimeValue = toEventDatetimeLocal(value);
  return isAllDay ? datetimeValue.slice(0, 10) : datetimeValue;
}

export function isAllDayDateRange(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
) {
  if (!startValue || !endValue) return false;

  const start = toEventDatetimeLocal(startValue);
  const end = toEventDatetimeLocal(endValue);
  return start.endsWith("T00:00") && end.endsWith("T23:59");
}

export function switchEventDateInputMode(value: string, isAllDay: boolean) {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  return isAllDay ? datePart : `${datePart}T00:00`;
}

export function switchEventEndDateInputMode(value: string, isAllDay: boolean) {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  return isAllDay ? datePart : `${datePart}T23:59`;
}
