const assert = require("node:assert/strict");
const test = require("node:test");
const { UpdateSurveySchema } = require("@soc/contracts");
const { buildSurveySchedule } = require("../dist/test-src/lib/survey-schedule.js");

test("incomplete survey drafts keep their explicit schedule mode", () => {
  for (const isAllDay of [false, true]) {
    const schedule = buildSurveySchedule({ isAlwaysOpen: false, isAllDay, openAt: "", closeAt: isAllDay ? "2026-10-28" : "2026-10-28T18:00" });
    assert.equal(schedule.isAlwaysOpen, false);
    assert.equal(schedule.openAt, null);
    assert.ok(schedule.closeAt);
    assert.equal(UpdateSurveySchema.safeParse(schedule).success, true);
  }
});

test("always-open toggles clear dates and all-day bounds use Korean calendar days", () => {
  assert.deepEqual(buildSurveySchedule({ isAlwaysOpen: true, openAt: "2026-10-28T09:00", closeAt: "2026-10-28T18:00" }), { isAlwaysOpen: true, openAt: null, closeAt: null });
  const schedule = buildSurveySchedule({ isAllDay: true, openAt: "2026-10-28", closeAt: "2026-10-28" });
  assert.equal(schedule.openAt, "2026-10-27T15:00:00.000Z");
  assert.equal(schedule.closeAt, "2026-10-28T14:59:00.000Z");
  assert.equal(UpdateSurveySchema.safeParse(schedule).success, true);
});
