const assert = require("node:assert/strict");
const test = require("node:test");
const { buildCalendarGrid, getEventLabelSegment, getCalendarEventStyles } = require("../dist/test-src/features/events-surveys/events-surveys-calendar-utils.js");

test("calendar uses five rows unless the month needs six", () => {
  assert.equal(buildCalendarGrid(2026, 8).length, 35);
  assert.equal(buildCalendarGrid(2026, 7).length, 42);
  assert.equal(buildCalendarGrid(2026, 1).length, 35);
});
test("wrapped event labels repeat once per week and never cross a month boundary", () => {
  const cells = buildCalendarGrid(2026, 8);
  const range = { start: cells[0].date, end: cells[34].date };
  const labels = cells.flatMap((cell, i) => {
    const segment = getEventLabelSegment(range, i, cells);
    if (segment.offsetDays !== Math.floor((segment.dayCount - 1) / 2)) return [];
    const start = i - segment.offsetDays;
    const covered = cells.slice(start, start + segment.dayCount);
    assert.ok(covered.every(day => day.isCurrentMonth === cell.isCurrentMonth));
    return [Math.floor(i / 7)];
  });
  assert.deepEqual([...new Set(labels)], [0, 1, 2, 3, 4]);
  assert.equal(labels.length, 7);
});
test("votes and surveys share blue bars with black text", () => {
  const survey = getCalendarEventStyles("SURVEY", "ko", "SURVEY");
  const vote = getCalendarEventStyles("EVENT", "ko", "VOTE");
  assert.equal(survey.bg, vote.bg);
  assert.ok(vote.bg.includes("text-black"));
});
