const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getVoteListState } = require("../dist/test-src/lib/vote-display.js");

test("vote cards unlock at the start time and show results at the end time", () => {
  const vote = { status: "PUBLISHED", startsAt: "2026-10-26T09:00:00+09:00", endsAt: "2026-10-27T09:00:00+09:00" };
  const start = Date.parse(vote.startsAt), end = Date.parse(vote.endsAt);
  assert.equal(getVoteListState(vote, start - 1), "upcoming");
  assert.equal(getVoteListState(vote, start), "open");
  assert.equal(getVoteListState(vote, end - 1), "open");
  assert.equal(getVoteListState(vote, end), "ended");
  for (const status of ["CLOSED", "TALLIED"]) {
    assert.equal(getVoteListState({ ...vote, status }, start - 1), "ended");
  }
});
