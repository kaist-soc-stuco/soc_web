const assert = require("node:assert/strict");
const {test} = require("node:test");
const {VotesService} = require("../dist/apps/api/src/features/votes/votes.service.js");
const {VotesRepository} = require("../dist/apps/api/src/features/votes/votes.repository.js");
const {Permissions, VoteItemInputSchema} = require("@soc/contracts");

test("custom selection feedback survives request validation and the response contract", async () => {
  const item = VoteItemInputSchema.parse({
    titleKo: "Agenda", type: "MULTIPLE_CHOICE", maxSelections: 2, selectionRule: "exact",
    selectionErrorMessage: "  Choose two programmes.  ",
    options: [{labelKo: "A"}, {labelKo: "B"}],
  });
  assert.equal(item.selectionErrorMessage, "Choose two programmes.");
  const now = new Date();
  const service = new VotesService({
    findVote: async () => ({status: "PUBLISHED", startsAt: now, endsAt: now, createdAt: now, updatedAt: now}),
    findVoter: async () => ({status: "ELIGIBLE", hasVoted: false}),
    findDefinition: async () => [{...item, itemId: "item", options: []}],
    counts: async () => ({eligibleCount: 0, votedCount: 0}),
  }, {});
  assert.equal((await service.detail("vote", {id: "eligible", permission: 0})).items[0].selectionErrorMessage, item.selectionErrorMessage);
  assert.equal(VoteItemInputSchema.safeParse({...item, selectionErrorMessage: "x".repeat(501)}).success, false);
});

test("vote detail is limited to eligible voters while managers retain access", async () => {
  const now = new Date();
  let resultsPublishedAt = null;
  const service = new VotesService({
    findVote: async () => ({status: "PUBLISHED", startsAt: now, endsAt: now, createdAt: now, updatedAt: now, resultsPublishedAt}),
    findVoter: async (_voteId, userId) => userId === "eligible" ? {status: "ELIGIBLE", hasVoted: false} : null,
    findDefinition: async () => [],
    counts: async () => ({eligibleCount: 1, votedCount: 0}),
  }, {});

  await assert.rejects(service.detail("vote"), /vote_not_found/);
  await assert.rejects(service.detail("vote", {id: "other", permission: 0}), /vote_not_found/);
  assert.equal((await service.detail("vote", {id: "eligible", permission: 0})).eligibility, "ELIGIBLE");
  assert.equal((await service.detail("vote", {id: "manager", permission: Permissions.MANAGE_VOTE})).isManager, true);
  resultsPublishedAt = now;
  assert.equal((await service.detail("vote")).eligibility, "LOGIN_REQUIRED");
});

function serviceFor(rule, limit = 2) {
  let submitted = false;
  const repo = {
    findVote: async () => ({status:"PUBLISHED", startsAt:new Date(Date.now()-60000), endsAt:new Date(Date.now()+60000), encryptedBallotKey:"test",keyIv:"test",keyTag:"test"}),
    findVoter: async () => ({status:"ELIGIBLE",hasVoted:false}),
    findDefinition: async () => [{itemId:"item",type:"MULTIPLE_CHOICE",maxSelections:limit,selectionRule:rule,options:[1,2,3].map(n=>({optionId:String(n)}))}],
    submitBallot: async () => { submitted=true; return "accepted"; },
  };
  const crypto = {createReceipt:()=>({code:"receipt",hash:"hash"}),unwrapVoteKey:()=>"key",encryptBallot:()=>({ciphertext:"x",iv:"x",authTag:"x"})};
  return {service:new VotesService(repo,crypto),submitted:()=>submitted};
}
for (const [rule, count, valid] of [["max",1,true],["max",2,true],["max",3,false],["min",1,false],["min",2,true],["min",3,true],["exact",1,false],["exact",2,true],["exact",3,false],[undefined,3,false]]) {
  test(`selection rule ${rule ?? "legacy max"} accepts ${count}: ${valid}`,async()=>{
    const fixture=serviceFor(rule);
    const submit=()=>fixture.service.submit("vote","user",{answers:[{itemId:"item",optionIds:["1","2","3"].slice(0,count)}]});
    if(valid) await submit(); else await assert.rejects(submit,/vote_too_(?:many|few)_selections/);
    assert.equal(fixture.submitted(),valid);
  });
}
test("close checks quorum while holding the same transaction lock as submissions",async()=>{
  for(const [voted, inclusive, allowed] of [[0,true,false],[1,true,true],[1,false,false],[2,false,true]]) {
    let locked=false, updated=false;
    const tx={select:()=>({from:()=>({where:()=>({for:()=>{locked=true;return {limit:async()=>[{voteId:"v",status:"PUBLISHED",quorumPercent:50,quorumInclusive:inclusive}]};}})})}),update:()=>{updated=true;return {set:()=>({where:()=>({returning:async()=>[{status:"CLOSED"}]})})};}};
    const repo=new VotesRepository({transaction:fn=>fn(tx)});
    repo.counts=async(id, scope)=>{assert.equal(scope,tx);assert.equal(locked,true);return {eligibleCount:2,votedCount:voted};};
    if(allowed) await repo.close("v"); else await assert.rejects(repo.close("v"),/vote_quorum_not_met/);
    assert.equal(updated,allowed);
  }
});
