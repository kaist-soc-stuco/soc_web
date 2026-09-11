import { isoToMs } from "@soc/shared";

const voteDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatVoteDateTime(value: string) {
  const timestamp = isoToMs(value);
  if (!Number.isFinite(timestamp)) return "";

  const parts = voteDateTimeFormatter.formatToParts(timestamp);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}.${getPart("month")}.${getPart("day")} ${getPart("hour")}:${getPart("minute")}`;
}

export function formatVotePeriod(startsAt: string, endsAt: string) {
  const start = formatVoteDateTime(startsAt);
  const end = formatVoteDateTime(endsAt);
  return `${start} ~ ${start.slice(0,4) === end.slice(0,4) ? end.slice(5) : end}`;
}
