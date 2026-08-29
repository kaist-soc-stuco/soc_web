const assert = require("node:assert/strict");
const test = require("node:test");

const { VoteCryptoService } = require("../dist/apps/api/src/features/votes/vote-crypto.service.js");

const config = {
  get(name) {
    return name === "VOTE_BALLOT_ENCRYPTION_KEY" ? "test-only-vote-key-with-more-than-thirty-two-characters" : undefined;
  },
  getOrThrow() {
    throw new Error("unexpected fallback");
  },
};

test("vote keys are wrapped and ballots round-trip without plaintext identity", () => {
  const crypto = new VoteCryptoService(config);
  const voteKey = crypto.generateVoteKey();
  const wrapped = crypto.wrapVoteKey(voteKey);
  const unwrapped = crypto.unwrapVoteKey(wrapped);
  assert.deepEqual(unwrapped, voteKey);

  const ballot = { answers: [{ itemId: "item-1", optionIds: ["option-2"] }] };
  const encrypted = crypto.encryptBallot(ballot, unwrapped);
  assert.equal(encrypted.ciphertext.includes("option-2"), false);
  assert.deepEqual(crypto.decryptBallot(encrypted, unwrapped), ballot);
});

test("two identical ballots receive different ciphertext and receipts", () => {
  const crypto = new VoteCryptoService(config);
  const key = crypto.generateVoteKey();
  const first = crypto.encryptBallot({ answer: "yes" }, key);
  const second = crypto.encryptBallot({ answer: "yes" }, key);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext + first.authTag, second.ciphertext + second.authTag);
  assert.notEqual(crypto.createReceipt().code, crypto.createReceipt().code);
});

test("production refuses to reuse the pending-login key for vote ballots", () => {
  const productionConfig = {
    get(name) {
      return name === "NODE_ENV" ? "production" : undefined;
    },
    getOrThrow() {
      return "pending-login-key";
    },
  };

  assert.throws(
    () => new VoteCryptoService(productionConfig),
    /VOTE_BALLOT_ENCRYPTION_KEY_is_required_in_production/,
  );
});
