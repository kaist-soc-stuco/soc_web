const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Permissions } = require("@soc/contracts");
const { VotesService } = require("../dist/apps/api/src/features/votes/votes.service.js");

function fixture(overrides = {}) {
  const vote = {
    voteId: "test-vote", status: "PUBLISHED", titleKo: "테스트 투표", titleEn: null,
    descriptionKo: null, descriptionEn: null,
    startsAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000),
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  let definitionReads = 0;
  const service = new VotesService({
    findVote: async () => vote,
    findVoter: async () => ({ status: "ELIGIBLE", hasVoted: false }),
    findDefinition: async () => { definitionReads++; return []; },
    counts: async () => ({ eligibleCount: 1, votedCount: 0 }),
  }, {});
  return { service, reads: () => definitionReads };
}

test("scheduled vote detail is blocked before reading questions for visitors and members", async () => {
  for (const caller of [undefined, { id: "member", permission: 0 }]) {
    const { service, reads } = fixture();
    await assert.rejects(service.detail("test-vote", caller), error => error.getStatus() === 403 && error.message === "vote_not_started");
    assert.equal(reads(), 0);
  }
});

test("scheduled votes remain available to managers for editing and preview", async () => {
  const { service } = fixture();
  const detail = await service.detail("test-vote", { id: "manager", permission: Permissions.MANAGE_VOTE });
  assert.equal(detail.isManager, true);
  assert.equal(detail.titleKo, "테스트 투표");
});

test("started and manually ended votes remain readable", async () => {
  const open = fixture({ startsAt: new Date(Date.now() - 3600000) });
  assert.equal((await open.service.detail("test-vote")).eligibility, "LOGIN_REQUIRED");
  for (const status of ["CLOSED", "TALLIED"]) {
    const { service } = fixture({ status });
    assert.equal((await service.detail("test-vote")).status, status);
  }
});
