
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {meetsVoteQuorum} = require('@soc/shared');
const {VotesService} = require('../dist/apps/api/src/features/votes/votes.service.js');
test('quorum uses unrounded participation and defaults legacy null to 50%', () => {
  for (const percent of [null, undefined, 50]) assert.equal(meetsVoteQuorum(1,0,percent), false);
  assert.equal(meetsVoteQuorum(2,1,50,true),true);
  assert.equal(meetsVoteQuorum(2,1,50,false),false);
  assert.equal(meetsVoteQuorum(10001,5000,50),false);
  assert.equal(meetsVoteQuorum(0,0,0),false);
  assert.equal(meetsVoteQuorum(1,1,50),true);
});
test('service refuses unopened ballots at zero turnout even for legacy null quorum', async () => {
  const repo = {findVote:async()=>({status:'CLOSED',quorumPercent:null,quorumInclusive:true}),counts:async()=>({eligibleCount:1,votedCount:0})};
  const service = new VotesService(repo, {});
  await assert.rejects(service.tally('synthetic'), /vote_quorum_not_met/);
});
