const assert = require("node:assert/strict");
const test = require("node:test");
const nodemailer = require("nodemailer");
const { EmailDeliveryService } = require("../dist/apps/api/src/features/email/email-delivery.service.js");
const { EmailDeliveryError } = require("../dist/apps/api/src/features/email/email-delivery-error.js");

const mail = { EMAIL_DRY_RUN: false, MAIL_HOST: "smtp.gmail.com", MAIL_PORT: 465, MAIL_SECURE: true, MAIL_USER: "sender@example.invalid", MAIL_PASS: "abcd efgh ijkl mnop", MAIL_FROM: "SoC <sender@example.invalid>" };
const message = { recipients: ["recipient@example.invalid"], subject: "Synthetic SMTP check", content: "Synthetic body" };
function createService(overrides = {}) {
  const values = { ...mail, ...overrides };
  return new EmailDeliveryService({ get: (key, fallback) => values[key] ?? fallback });
}

test("Gmail SSL delivery uses MAIL_* and preserves BCC, attachments, IDs and pooling", async t => {
  const transports = [];
  const delivered = [];
  let closed = false;
  t.mock.method(nodemailer, "createTransport", options => {
    transports.push(options);
    return {
      async sendMail(input) { delivered.push(input); return { messageId: input.messageId, accepted: input.bcc, rejected: [] }; },
      close() { closed = true; },
    };
  });
  const service = createService();
  const attachments = [{ filename: "fixture.txt", content: Buffer.from("fixture"), contentType: "text/plain", cid: "fixture" }];
  const result = await service.send({ ...message, html: "<p>Synthetic body</p>", messageId: "<fixture@example.invalid>", attachments });
  assert.deepEqual(result, { dryRun: false, messageId: "<fixture@example.invalid>", acceptedCount: 1, rejectedCount: 0 });
  assert.equal(transports[0].host, "smtp.gmail.com");
  assert.equal(transports[0].port, 465);
  assert.equal(transports[0].secure, true);
  assert.equal(transports[0].requireTLS, false);
  assert.deepEqual(transports[0].auth, { user: mail.MAIL_USER, pass: "abcdefghijklmnop" });
  assert.equal(transports[0].pool, true);
  assert.equal(transports[0].maxRequeues, 0);
  assert.equal(delivered[0].from, mail.MAIL_FROM);
  assert.deepEqual(delivered[0].bcc, message.recipients);
  assert.equal(delivered[0].text, message.content);
  assert.equal(delivered[0].html, "<p>Synthetic body</p>");
  assert.deepEqual(delivered[0].attachments, attachments);
  await service.send(message);
  assert.equal(transports.length, 1);
  service.onModuleDestroy();
  assert.equal(closed, true);
});

test("port 587 requires STARTTLS and never disables certificate verification", async t => {
  let transport;
  t.mock.method(nodemailer, "createTransport", options => {
    transport = options;
    return { sendMail: async () => ({ accepted: message.recipients, rejected: [] }) };
  });
  await createService({ MAIL_PORT: 587, MAIL_SECURE: false }).send(message);
  assert.equal(transport.secure, false);
  assert.equal(transport.requireTLS, true);
  assert.notEqual(transport.tls?.rejectUnauthorized, false);
});

test("dry runs never create an SMTP connection or require Gmail credentials", async t => {
  t.mock.method(nodemailer, "createTransport", () => assert.fail("Dry-run must not connect"));
  assert.deepEqual(await createService({ EMAIL_DRY_RUN: true, MAIL_USER: undefined, MAIL_PASS: undefined, MAIL_FROM: undefined }).send(message), { dryRun: true });
});

test("missing Gmail credentials or sender fails before making a connection", async t => {
  t.mock.method(nodemailer, "createTransport", () => assert.fail("Incomplete configuration must not connect"));
  for (const key of ["MAIL_USER", "MAIL_PASS", "MAIL_FROM"]) {
    await assert.rejects(createService({ [key]: "" }).send(message), /email_delivery_not_configured/);
  }
});

test("Gmail authentication rejection is definite while an uncertain timeout stays ambiguous", async t => {
  let failure;
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => { throw failure; } }));
  const service = createService();
  failure = Object.assign(new Error("synthetic-auth-rejection"), { responseCode: 535, code: "EAUTH" });
  await assert.rejects(service.send(message), error => error instanceof EmailDeliveryError && error.kind === "pre_send");
  failure = Object.assign(new Error("synthetic-timeout"), { code: "ETIMEDOUT" });
  await assert.rejects(service.send(message), error => error instanceof EmailDeliveryError && error.kind === "ambiguous");
});
