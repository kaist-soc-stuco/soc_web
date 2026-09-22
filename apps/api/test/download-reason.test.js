const assert = require("node:assert/strict");
const test = require("node:test");
const { BadRequestException } = require("@nestjs/common");

const { AuditLogController } = require("../dist/apps/api/src/features/audit/audit-log.controller.js");
const { requireDownloadReason } = require("../dist/apps/api/src/features/audit/download-reason.js");

test("download reason is required and bounded", () => {
  for (const value of [undefined, "", " ", "a", "x".repeat(201)]) {
    assert.throws(
      () => requireDownloadReason(value),
      (error) => error instanceof BadRequestException && error.message === "download_reason_required",
    );
  }
  assert.equal(requireDownloadReason("  업무 인수인계  "), "업무 인수인계");
});

test("personal-data download records reason, actor, IP, target, and count", async () => {
  let recorded;
  const controller = new AuditLogController({
    record: async (input) => { recorded = input; },
  });

  const result = await controller.recordPersonalDataDownload(
    { ip: "203.0.113.10", user: { id: "admin-user" } },
    {
      count: 12,
      kind: "survey_responses",
      reason: "응답 검토",
      targetId: "survey-1",
    },
  );

  assert.deepEqual(result, { success: true });
  assert.equal(recorded.action, "privacy.download");
  assert.equal(recorded.actorUserId, "admin-user");
  assert.equal(recorded.ipAddress, "203.0.113.10");
  assert.equal(recorded.targetId, "survey-1");
  assert.equal(recorded.targetType, "survey_response");
  assert.deepEqual(recorded.payload, {
    count: 12,
    kind: "survey_responses",
    reason: "응답 검토",
  });
});

test("personal-data download rejects a missing reason", async () => {
  const controller = new AuditLogController({ record: async () => assert.fail("recorded") });
  await assert.rejects(
    controller.recordPersonalDataDownload(
      { ip: "203.0.113.10", user: { id: "admin-user" } },
      { kind: "vote_roster", targetId: "vote-1" },
    ),
    (error) => error instanceof BadRequestException && error.message === "download_reason_required",
  );
});
