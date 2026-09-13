const assert = require("node:assert/strict");
const test = require("node:test");
const { Permissions } = require("@soc/contracts");
const { SurveyResponsesService } = require("../dist/apps/api/src/features/surveys/survey-responses.service.js");

test("notification only goes to opted-in managers, without respondent data", async () => {
  const delivered = [];
  const service = new SurveyResponsesService(
    { getEmailSubscribers: async () => [{ userId: "manager", email: "manager@example.invalid" }, { userId: "revoked", email: "revoked@example.invalid" }] },
    {}, { resolvePermissionBitmaskByUserId: async id => id === "manager" ? Permissions.MANAGE_SURVEY : 0 },
    undefined, undefined, undefined, undefined, undefined,
    { send: async input => delivered.push(input) },
  );
  await service.notifyNewResponse("survey", "<b>설문</b>");
  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0].recipients, ["manager@example.invalid"]);
  assert.ok(!delivered[0].content.includes("<b>"));
});

test("mail failure does not reject response notification or prevent remaining recipients", async () => {
  let calls = 0;
  const service = new SurveyResponsesService(
    { getEmailSubscribers: async () => [{ userId:"a", email:"a@example.invalid" }, { userId:"b", email:"b@example.invalid" }] },
    {}, { resolvePermissionBitmaskByUserId: async () => Permissions.MANAGE_SURVEY },
    undefined, undefined, undefined, undefined, undefined,
    { send: async () => { if (++calls === 1) throw Error("SMTP unavailable"); } },
  );
  await service.notifyNewResponse("survey", "설문");
  assert.equal(calls, 2);
});

test("delete all is scoped to survey and records audit and sheet refresh", async () => {
  const calls = [];
  const service = new SurveyResponsesService(
    { deleteAllResponses: async id => { calls.push(["delete", id]); return { deletedCount: 2 }; } },
    { findById: async id => ({ id }) }, {},
    undefined, undefined, undefined,
    { enqueueRefresh: async id => calls.push(["sheet", id]) },
    { record: async input => calls.push(["audit", input.actorUserId, input.targetId, input.payload.deletedCount]) },
  );
  assert.deepEqual(await service.deleteAll("survey-a", "admin"), { deletedCount: 2 });
  assert.deepEqual(calls, [["delete","survey-a"], ["audit","admin","survey-a",2], ["sheet","survey-a"]]);
});

test("missing surveys cannot create subscriptions or delete responses", async () => {
  const service = new SurveyResponsesService({}, { findById: async () => null }, {});
  await assert.rejects(service.deleteAll("missing", "admin"), /survey_not_found/);
  await assert.rejects(service.setEmailSubscription("missing", "admin", true), /survey_not_found/);
});
