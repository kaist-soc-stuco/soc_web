const assert = require("node:assert/strict");
const test = require("node:test");

const { BulkEmailService } = require("../dist/apps/api/src/features/email/bulk-email.service.js");
const {
  EmailDeliveryError,
} = require("../dist/apps/api/src/features/email/email-delivery-error.js");

const senderId = "00000000-0000-4000-8000-000000000001";

function makeRecipient() {
  return {
    email: "synthetic-recipient@example.test",
    nameKo: "합성 수신자",
    phoneNumber: null,
    studentNumber: "SYNTHETIC-001",
  };
}

function makeRecord(id, status, idempotencyKey = null) {
  const timestamp = "2026-09-08T00:00:00.000Z";
  return {
    id,
    subject: "합성 메일",
    content: "합성 본문",
    contentType: "plain",
    recipientType: "ALL",
    filters: {},
    attachmentCount: 0,
    senderId,
    senderName: "합성 발신자",
    recipientCount: 1,
    status,
    scheduledAt: null,
    updatedAt: timestamp,
    sentAt: timestamp,
    recipientFilters: {},
    attachmentAssetIds: [],
    errorMessage: null,
    completedAt: null,
    idempotencyKey,
  };
}

function makeRequest(idempotencyKey) {
  return {
    subject: "합성 메일",
    content: "합성 본문",
    contentType: "plain",
    recipientType: "ALL",
    filters: {},
    attachmentAssetIds: [],
    idempotencyKey,
  };
}

function makeService({
  send,
  recordStatus = "PENDING",
  idempotencyKey = null,
  persistFailure = false,
  auditLogService,
}) {
  const state = {
    sendCount: 0,
    attemptCount: 0,
    status: recordStatus,
    record: makeRecord("email-synthetic-001", recordStatus, idempotencyKey),
    statuses: [],
    attempts: [],
    persistFailure,
  };

  const bulkEmailRepo = {
    async findByIdempotencyKey(_sender, key) {
      return state.record.idempotencyKey === key ? state.record : null;
    },
    async create(input) {
      state.record = makeRecord("email-synthetic-001", input.status, input.idempotencyKey);
      state.record.subject = input.subject;
      state.record.content = input.content;
      state.record.contentType = input.contentType;
      state.record.recipientType = input.recipientType;
      state.record.recipientFilters = input.recipientFilters ?? {};
      state.record.filters = state.record.recipientFilters;
      state.record.attachmentAssetIds = input.attachmentAssetIds ?? [];
      state.record.recipientCount = input.recipientCount;
      return state.record.id;
    },
    async createDeliveryAttempt(emailId, messageId) {
      state.attemptCount += 1;
      const attempt = {
        attemptId: `attempt-${state.attemptCount}`,
        emailId,
        attemptNumber: state.attemptCount,
        messageId,
        status: "PENDING",
      };
      state.attempts.push(attempt);
      return attempt;
    },
    async markDeliveryAttemptSending(attemptId) {
      const attempt = state.attempts.find((item) => item.attemptId === attemptId);
      if (!attempt || attempt.status !== "PENDING") return false;
      attempt.status = "SENDING";
      return true;
    },
    async finishDeliveryAttempt(attemptId, status, details = {}) {
      if (state.persistFailure && status === "SENT") {
        state.persistFailure = false;
        throw new Error("synthetic_db_write_lost_after_provider_accept");
      }
      const attempt = state.attempts.find((item) => item.attemptId === attemptId);
      if (attempt) Object.assign(attempt, { status, ...details });
    },
    async updateStatus(_emailId, status, errorMessage = null) {
      state.status = status;
      state.record.status = status;
      state.record.errorMessage = errorMessage;
      state.statuses.push(status);
    },
    async claimFailedForRetry(_sender, emailId) {
      if (state.record.id !== emailId || state.status !== "FAILED") return null;
      if (state.attempts.some((attempt) => ["SENDING", "SENT", "UNKNOWN"].includes(attempt.status))) {
        return null;
      }
      state.status = "PENDING";
      state.record.status = "PENDING";
      state.record.completedAt = null;
      return state.record;
    },
  };

  const usersService = {
    async listEmailRecipients() {
      return [makeRecipient()];
    },
  };
  const emailDeliveryService = {
    async send(input) {
      state.sendCount += 1;
      return send(input, state.sendCount);
    },
  };
  const configService = {
    get(_key, fallback) {
      return fallback;
    },
  };
  const assetService = {};
  const service = new BulkEmailService(
    bulkEmailRepo,
    usersService,
    emailDeliveryService,
    configService,
    assetService,
    undefined,
    auditLogService,
  );

  return { service, state };
}

test("provider acceptance followed by DB persistence loss becomes UNKNOWN and is not replayed", async () => {
  const idempotencyKey = "request-key-ambiguous-0001";
  const { service, state } = makeService({
    idempotencyKey: null,
    persistFailure: true,
    send: async () => ({
      dryRun: false,
      messageId: "provider-message-001",
      acceptedCount: 1,
      rejectedCount: 0,
    }),
  });

  await assert.rejects(
    service.sendBulkEmail(senderId, makeRequest(idempotencyKey)),
    (error) => error instanceof EmailDeliveryError && error.kind === "ambiguous",
  );
  assert.equal(state.sendCount, 1);
  assert.equal(state.status, "UNKNOWN");
  assert.equal(state.attempts[0].status, "UNKNOWN");

  const replay = await service.sendBulkEmail(senderId, makeRequest(idempotencyKey));
  assert.deepEqual(
    { success: replay.success, deliveryMode: replay.deliveryMode },
    { success: false, deliveryMode: "unknown" },
  );
  assert.equal(state.sendCount, 1);
});

test("definite pre-send rejection is FAILED and an explicit retry can send once", async () => {
  const { service, state } = makeService({
    send: async (_input, count) => {
      if (count === 1) {
        throw new EmailDeliveryError("synthetic_smtp_rejected", "pre_send", {
          rejectedCount: 1,
        });
      }
      return {
        dryRun: false,
        messageId: "provider-message-002",
        acceptedCount: 1,
        rejectedCount: 0,
      };
    },
  });

  await assert.rejects(
    service.sendBulkEmail(senderId, makeRequest(null)),
    (error) => error instanceof EmailDeliveryError && error.kind === "pre_send",
  );
  assert.equal(state.status, "FAILED");
  assert.equal(state.attempts[0].status, "FAILED");

  const retry = await service.retryFailed(senderId, state.record.id);
  assert.equal(retry.success, true);
  assert.equal(retry.deliveryMode, "sent");
  assert.equal(state.sendCount, 2);
  assert.equal(state.status, "SUCCESS");
  assert.equal(state.attempts[1].status, "SENT");
});

test("post-delivery audit failure does not make a sent email retryable", async () => {
  const idempotencyKey = "request-key-audit-failure-0001";
  const { service, state } = makeService({
    send: async () => ({
      dryRun: false,
      messageId: "provider-message-audit-001",
      acceptedCount: 1,
      rejectedCount: 0,
    }),
    auditLogService: {
      record: async () => {
        throw new Error("synthetic_audit_store_failure");
      },
    },
  });

  const first = await service.sendBulkEmail(senderId, makeRequest(idempotencyKey));
  assert.equal(first.success, true);
  assert.equal(state.sendCount, 1);
  assert.equal(state.status, "SUCCESS");

  const replay = await service.sendBulkEmail(senderId, makeRequest(idempotencyKey));
  assert.equal(replay.deliveryMode, "sent");
  assert.equal(state.sendCount, 1);
});

test("a FAILED aggregate cannot retry when its delivery attempt was accepted", async () => {
  const { service, state } = makeService({
    send: async () => ({
      dryRun: false,
      messageId: "provider-message-mismatch-001",
      acceptedCount: 1,
      rejectedCount: 0,
    }),
  });

  await service.sendBulkEmail(senderId, makeRequest(null));
  state.status = "FAILED";
  state.record.status = "FAILED";
  assert.equal(state.attempts[0].status, "SENT");

  await assert.rejects(
    service.retryFailed(senderId, state.record.id),
    /bulk_email_not_failed_or_not_owned/,
  );
  assert.equal(state.sendCount, 1);
});

test("provider timeout remains UNKNOWN and cannot be retried as FAILED", async () => {
  const { service, state } = makeService({
    send: async () => {
      throw new EmailDeliveryError("synthetic_smtp_timeout", "ambiguous");
    },
  });

  await assert.rejects(
    service.sendBulkEmail(senderId, makeRequest(null)),
    (error) => error instanceof EmailDeliveryError && error.kind === "ambiguous",
  );
  assert.equal(state.sendCount, 1);
  assert.equal(state.status, "UNKNOWN");
  await assert.rejects(
    service.retryFailed(senderId, state.record.id),
    /bulk_email_not_failed_or_not_owned/,
  );
  assert.equal(state.sendCount, 1);
});

test("partial provider acceptance is recorded as UNKNOWN with recipient counts", async () => {
  const idempotencyKey = "request-key-partial-0001";
  const { service, state } = makeService({
    send: async () => ({
      dryRun: false,
      messageId: "provider-message-partial-001",
      acceptedCount: 1,
      rejectedCount: 1,
    }),
  });

  await assert.rejects(
    service.sendBulkEmail(senderId, makeRequest(idempotencyKey)),
    (error) => error instanceof EmailDeliveryError && error.kind === "ambiguous",
  );
  assert.equal(state.sendCount, 1);
  assert.equal(state.status, "UNKNOWN");
  assert.equal(state.attempts[0].status, "UNKNOWN");
  assert.equal(state.attempts[0].acceptedCount, 1);
  assert.equal(state.attempts[0].rejectedCount, 1);

  const replay = await service.sendBulkEmail(senderId, makeRequest(idempotencyKey));
  assert.equal(replay.deliveryMode, "unknown");
  assert.equal(state.sendCount, 1);
});
