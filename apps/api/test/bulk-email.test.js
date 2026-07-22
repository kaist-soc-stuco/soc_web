const assert = require("node:assert/strict");
const test = require("node:test");
const { NotImplementedException } = require("@nestjs/common");

const {
  BULK_EMAIL_DELIVERY_NOT_CONFIGURED,
  BulkEmailService,
} = require("../dist/apps/api/src/features/email/bulk-email.service.js");

test("bulk email delivery fails closed before resolving recipients or recording success", async () => {
  let recipientLookupCalled = false;
  let insertCalled = false;
  const repository = {
    findAll: async () => [],
    findRecipientEmails: async () => {
      recipientLookupCalled = true;
      return ["student@example.com"];
    },
    insert: async () => {
      insertCalled = true;
      throw new Error("a disabled delivery path must not insert a success record");
    },
  };
  const service = new BulkEmailService(repository);

  await assert.rejects(
    service.sendBulkEmail("admin-1", {
      subject: "개인정보 안내",
      content: "민감한 메일 본문",
      recipientType: "ALL",
    }),
    (error) => {
      assert.ok(error instanceof NotImplementedException);
      assert.equal(error.getStatus(), 501);
      assert.equal(error.message, BULK_EMAIL_DELIVERY_NOT_CONFIGURED);
      return true;
    },
  );

  assert.equal(recipientLookupCalled, false);
  assert.equal(insertCalled, false);
});
