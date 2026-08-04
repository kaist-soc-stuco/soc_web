const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parts(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Converts an API instant to the local value consumed by datetime-local. */
export function instantToLocal(value: string | null | undefined): string {
  if (!value) return '';
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? '' : parts(instant);
}

/**
 * Converts a local datetime-local value to an instant. A nonexistent (gap)
 * wall-clock time is invalid; an ambiguous (overlap) time resolves to its
 * earlier instant.
 */
export function localToInstant(value: string): string | null {
  const match = localPattern.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const calendar = new Date(utc);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day) || calendar.getUTCHours() !== Number(hour) || calendar.getUTCMinutes() !== Number(minute)) return null;

  const offsets = new Set<number>();
  for (let timestamp = utc - 86_400_000; timestamp <= utc + 86_400_000; timestamp += 3_600_000)
    offsets.add(new Date(timestamp).getTimezoneOffset());
  const candidates = [...offsets]
    .map((offset) => new Date(utc + offset * 60_000))
    .filter((candidate) => parts(candidate) === value)
    .sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]?.toISOString() ?? null;
}

export function isValidLocalInstant(value: string): boolean {
  return value === '' || localToInstant(value) !== null;
}
