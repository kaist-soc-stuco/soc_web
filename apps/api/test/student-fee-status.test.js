const assert = require("node:assert/strict");
const test = require("node:test");

const { UpdateStudentFeeStatusSchema } = require("@soc/contracts");
const {
  UsersRepository,
} = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const {
  UsersService,
} = require("../dist/apps/api/src/features/users/users.service.js");

const USER_ID = "48cf27f9-c914-4485-adb8-7cec115a6b15";

function createFeeRepository(initialRow) {
  let row = initialRow ? { ...initialRow } : null;
  const lockRequests = [];
  let rootSelectCalls = 0;

  const database = {
    select: () => {
      rootSelectCalls += 1;
      throw new Error("fee updates must not re-read outside their transaction");
    },
    transaction: async (callback) => {
      let transactionSelectIndex = 0;
      const transactionClient = {
        select: () => {
          transactionSelectIndex += 1;
          const target = transactionSelectIndex === 1 ? "user" : "fee-status";
          return {
            from: () => ({
              where: () => {
                const query = {
                  orderBy: () => query,
                  for: (strength) => {
                    assert.equal(strength, "update");
                    lockRequests.push({ strength, target });
                    return query;
                  },
                  limit: async () =>
                    target === "user" ? [{ userId: USER_ID }] : row ? [row] : [],
                };
                return query;
              },
            }),
          };
        },
        update: () => ({
          set: (nextRecord) => ({
            where: () => ({
              returning: async () => {
                row = { ...row, ...nextRecord };
                return [row];
              },
            }),
          }),
        }),
        insert: () => ({
          values: (nextRecord) => ({
            returning: async () => {
              row = { ...nextRecord };
              return [row];
            },
          }),
        }),
      };

      return callback(transactionClient);
    },
  };

  return {
    getLockRequested: () => lockRequests.length > 0,
    getLockRequests: () => [...lockRequests],
    getRootSelectCalls: () => rootSelectCalls,
    getRow: () => row,
    repository: new UsersRepository(database, null, null),
  };
}

function feeRow(overrides = {}) {
  return {
    userId: USER_ID,
    coverageSemesters: 4,
    status: "UNPAID",
    paidAt: null,
    verifiedBy: null,
    verifiedAt: null,
    note: null,
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("fee update contract accepts a note-only update but rejects an empty update", () => {
  assert.deepEqual(UpdateStudentFeeStatusSchema.parse({ note: "receipt checked" }), {
    note: "receipt checked",
  });
  assert.equal(UpdateStudentFeeStatusSchema.safeParse({}).success, false);
});

test("first fee update locks the parent user before checking the optional fee row", async () => {
  const { getLockRequests, getRootSelectCalls, repository } = createFeeRepository(null);

  const result = await repository.updateStudentFeeStatus(USER_ID, {
    status: "PAID",
    verifiedBy: "paid-admin",
  });

  assert.equal(result.status, "PAID");
  assert.deepEqual(getLockRequests(), [
    { strength: "update", target: "user" },
    { strength: "update", target: "fee-status" },
  ]);
  assert.equal(getRootSelectCalls(), 0);
});

test("note-only and legacy same-status updates preserve payment evidence timestamps", async () => {
  const paidAt = new Date("2026-06-10T03:00:00.000Z");
  const verifiedAt = new Date("2026-06-10T03:05:00.000Z");
  const { getLockRequested, getRow, repository } = createFeeRepository(
    feeRow({
      status: "PAID",
      paidAt,
      verifiedAt,
      verifiedBy: "original-verifier",
      note: "original note",
    }),
  );

  const noteOnlyResult = await repository.updateStudentFeeStatus(USER_ID, {
    note: "updated note",
  });

  assert.equal(noteOnlyResult.note, "updated note");
  assert.equal(noteOnlyResult.paidAt, paidAt.toISOString());
  assert.equal(noteOnlyResult.verifiedAt, verifiedAt.toISOString());
  assert.equal(noteOnlyResult.verifiedBy, "original-verifier");
  assert.strictEqual(getRow().paidAt, paidAt);
  assert.strictEqual(getRow().verifiedAt, verifiedAt);
  assert.equal(getLockRequested(), true);

  const legacyResult = await repository.updateStudentFeeStatus(USER_ID, {
    status: "PAID",
    note: "legacy client note",
    verifiedBy: "different-admin",
  });

  assert.equal(legacyResult.note, "legacy client note");
  assert.equal(legacyResult.paidAt, paidAt.toISOString());
  assert.equal(legacyResult.verifiedAt, verifiedAt.toISOString());
  assert.equal(legacyResult.verifiedBy, "original-verifier");
  assert.strictEqual(getRow().paidAt, paidAt);
  assert.strictEqual(getRow().verifiedAt, verifiedAt);
});

test("real PAID and UNPAID transitions update payment evidence exactly once", async () => {
  const { getRow, repository } = createFeeRepository(feeRow());

  const paid = await repository.updateStudentFeeStatus(USER_ID, {
    status: "PAID",
    verifiedBy: "paid-admin",
  });
  const firstPaidAt = getRow().paidAt;
  const firstVerifiedAt = getRow().verifiedAt;

  assert.ok(firstPaidAt instanceof Date);
  assert.ok(firstVerifiedAt instanceof Date);
  assert.equal(paid.paidAt, firstPaidAt.toISOString());
  assert.equal(paid.verifiedAt, firstVerifiedAt.toISOString());
  assert.equal(paid.verifiedBy, "paid-admin");

  await repository.updateStudentFeeStatus(USER_ID, {
    status: "PAID",
    note: "same status",
    verifiedBy: "same-status-admin",
  });
  assert.strictEqual(getRow().paidAt, firstPaidAt);
  assert.strictEqual(getRow().verifiedAt, firstVerifiedAt);
  assert.equal(getRow().verifiedBy, "paid-admin");

  const unpaid = await repository.updateStudentFeeStatus(USER_ID, {
    status: "UNPAID",
    verifiedBy: "unpaid-admin",
  });
  const unpaidVerifiedAt = getRow().verifiedAt;

  assert.equal(unpaid.status, "UNPAID");
  assert.equal(unpaid.paidAt, null);
  assert.ok(unpaidVerifiedAt instanceof Date);
  assert.notStrictEqual(unpaidVerifiedAt, firstVerifiedAt);
  assert.equal(unpaid.verifiedBy, "unpaid-admin");

  await repository.updateStudentFeeStatus(USER_ID, {
    note: "unpaid note",
  });
  assert.equal(getRow().paidAt, null);
  assert.strictEqual(getRow().verifiedAt, unpaidVerifiedAt);
  assert.equal(getRow().verifiedBy, "unpaid-admin");

  const repaid = await repository.updateStudentFeeStatus(USER_ID, {
    status: "PAID",
    verifiedBy: "repaid-admin",
  });

  assert.equal(repaid.status, "PAID");
  assert.ok(getRow().paidAt instanceof Date);
  assert.notStrictEqual(getRow().paidAt, firstPaidAt);
  assert.equal(repaid.verifiedBy, "repaid-admin");
});

test("note-only fee updates remain visible in the existing audit trail", async () => {
  const record = {
    userId: USER_ID,
    status: "PAID",
    coverageSemesters: 4,
    paidAt: "2026-06-10T03:00:00.000Z",
    verifiedBy: "original-verifier",
    verifiedAt: "2026-06-10T03:05:00.000Z",
    note: "updated note",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
  let auditEntry;
  const queuedResources = [];
  const service = new UsersService(
    {
      updateStudentFeeStatus: async () => record,
    },
    {
      record: async (entry) => {
        auditEntry = entry;
      },
    },
    undefined,
    {
      enqueue: async (resourceType) => queuedResources.push(resourceType),
    },
  );

  await service.updateStudentFeeStatus(
    USER_ID,
    { note: "updated note" },
    { actorUserId: "admin-user", ipAddress: "127.0.0.1" },
  );

  assert.equal(auditEntry.action, "student_fee_status.update");
  assert.equal(auditEntry.actorUserId, "admin-user");
  assert.equal(auditEntry.targetId, USER_ID);
  assert.deepEqual(auditEntry.payload, {
    input: { note: "updated note" },
    record,
  });
  assert.deepEqual(queuedResources, ["STUDENT_FEES"]);
});
