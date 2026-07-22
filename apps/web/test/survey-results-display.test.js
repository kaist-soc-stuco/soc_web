const assert = require("node:assert/strict");
const test = require("node:test");

const {
  sortChoiceResults,
} = require("../dist/test-src/lib/survey-results-display.js");

test("sorts choice rows without changing respondent-based percentages", () => {
  const choices = [
    { value: "a", labelKo: "긴 선택지 A", labelEn: null, count: 4, percentage: 40 },
    { value: "b", labelKo: "긴 선택지 B", labelEn: null, count: 9, percentage: 90 },
    { value: "c", labelKo: "긴 선택지 C", labelEn: null, count: 1, percentage: 10 },
  ];

  const result = sortChoiceResults(choices);

  assert.deepEqual(result.map((choice) => choice.value), ["b", "a", "c"]);
  assert.equal(result[0].percentage, 90);
});
