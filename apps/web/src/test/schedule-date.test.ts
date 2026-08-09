import { describe, expect, it } from 'vitest';

import {
  formatRecordDateTime,
  formatScheduleDate,
  formatScheduleDateTime,
  formatScheduleRange,
} from '@/lib/schedule-date';

const reference = new Date(2026, 7, 7, 12, 0);

describe('schedule date formatting', () => {
  it('omits the year for dates in the reference year', () => {
    expect(formatScheduleDate(new Date(2026, 6, 8), reference)).toBe('07.08');
  });

  it('keeps the year when it differs from the reference year', () => {
    expect(formatScheduleDate(new Date(2027, 0, 3), reference)).toBe('2027.01.03');
  });

  it('treats date-only ISO values as local calendar dates', () => {
    expect(formatScheduleDate('2026-07-08', reference)).toBe('07.08');
  });

  it('uses 24-hour time and compacts same-day ranges', () => {
    expect(formatScheduleDateTime(new Date(2026, 6, 8, 9, 5), reference)).toBe('07.08 09:05');
    expect(formatScheduleRange(new Date(2026, 6, 8, 9, 0), new Date(2026, 6, 8, 11, 30), { referenceDate: reference })).toBe('07.08 09:00–11:30');
  });

  it('always includes the year for record timestamps', () => {
    expect(formatRecordDateTime(new Date(2026, 6, 8, 9, 5))).toBe('2026.07.08 09:05');
  });
});
