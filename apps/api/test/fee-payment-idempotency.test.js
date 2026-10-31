const assert = require("node:assert/strict");
const test = require("node:test");

const { BulkProcessStudentFeePaymentsSchema } = require("@soc/contracts");
const { hashStudentFeePaymentPayload } = require("../dist/apps/api/src/features/users/fee-payment-idempotency.js");

const basePayment = {
  userId: "00000000-0000-4000-8000-000000000001",
  amount: 1000,
  paymentType: "SIX_SEMESTER_LUMP_SUM",
  
  effectiveStartSemester: "2026-1",
  coverageSemesters: 6,
  paidAt: "2026-09-08T00:00:00.000Z",
};

test("payment idempotency hash is independent of object key order but changes with payload", () => {
  const first = {
    idempotencyKey: "request-key-0001",
    payments: [basePayment],
  };
  const reordered = {
    payments: [{
      paidAt: basePayment.paidAt,
      coverageSemesters: basePayment.coverageSemesters,
      effectiveStartSemester: basePayment.effectiveStartSemester,
      paymentMethod: basePayment.paymentMethod,
      paymentType: basePayment.paymentType,
      amount: basePayment.amount,
      userId: basePayment.userId,
    }],
    idempotencyKey: "request-key-0001",
  };
  const changed = {
    ...first,
    payments: [{ ...basePayment, amount: 2000 }],
  };

  assert.equal(hashStudentFeePaymentPayload(first), hashStudentFeePaymentPayload(reordered));
  assert.notEqual(hashStudentFeePaymentPayload(first), hashStudentFeePaymentPayload(changed));
});

test("payment batches require a bounded idempotency key", () => {
  assert.equal(
    BulkProcessStudentFeePaymentsSchema.safeParse({ payments: [basePayment] }).success,
    false,
  );
  assert.equal(
    BulkProcessStudentFeePaymentsSchema.safeParse({
      idempotencyKey: "request-key-0001",
      payments: [basePayment],
    }).success,
    true,
  );
});

test("payment targets accept a registered account or an unregistered student number exclusively", () => {
  const target = { idempotencyKey: "target-check-0001", payments: [{ ...basePayment, userId: undefined, stdNo: "20990001" }] };
  assert.equal(BulkProcessStudentFeePaymentsSchema.safeParse(target).success, true);
  assert.equal(BulkProcessStudentFeePaymentsSchema.safeParse({...target,payments:[{...basePayment,stdNo:"20990001"}]}).success, false);
  assert.equal(BulkProcessStudentFeePaymentsSchema.safeParse({...target,payments:[{...basePayment,userId:undefined}]}).success, false);
});
