const assert = require("node:assert/strict");
const test = require("node:test");
const {BulkEmailService} = require("../dist/apps/api/src/features/email/bulk-email.service.js");

test("personalized delivery limits concurrent sends and preserves message IDs", async () => {
  let active=0, peak=0;
  const ids=[];
  const service=Object.create(BulkEmailService.prototype);
  service.emailDeliveryService={send:async input=>{
    peak=Math.max(peak,++active);
    ids.push(input.messageId);
    await new Promise(resolve=>setImmediate(resolve));
    active--;
    return {dryRun:true,acceptedCount:1};
  }};
  const result=await service.deliverPersonalized(
    Array.from({length:21},(_,i)=>({email:`synthetic-${i}@example.invalid`})),
    {subject:"Test",content:"Body",contentType:"plain"},[],"job-1",
  );
  assert.equal(peak,5);
  assert.equal(result.acceptedCount,21);
  assert.deepEqual(ids,Array.from({length:21},(_,i)=>`job-1.${i+1}`));
});
