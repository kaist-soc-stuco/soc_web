const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const {
  BoundedFetchError,
  fetchBoundedText,
} = require("../dist/apps/api/src/shared/http/bounded-fetch.js");
const {
  assertSafeSurveyRegex,
  testSafeSurveyRegex,
} = require("../dist/apps/api/src/features/surveys/survey-regex-policy.js");
const { SurveyResponsesRepository } = require("../dist/apps/api/src/features/surveys/survey-responses.repository.js");

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(url);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("survey regex policy isolates execution and keeps syntax validation", async () => {
  assert.doesNotThrow(() => assertSafeSurveyRegex("^[A-Z0-9._%+-]+@example\\.invalid$"));
  assert.doesNotThrow(() => assertSafeSurveyRegex("^((a|aa))+$"));
  assert.doesNotThrow(() => assertSafeSurveyRegex("^(?=.{3,})\\1?$"));
  assert.throws(() => assertSafeSurveyRegex("("), /answer_regex_invalid/);
  assert.throws(() => assertSafeSurveyRegex("a".repeat(257)), /answer_regex_too_long/);
  await assert.rejects(
    testSafeSurveyRegex("^((a|aa))+$", "a".repeat(40) + "!"),
    /answer_regex_timeout/,
  );
  assert.equal(
    await testSafeSurveyRegex("^[A-Z0-9._%+-]+@example\\.invalid$", "A@EXAMPLE.INVALID"),
    false,
  );
});

test("survey answer batch rejects an oversized response-id set before querying", async () => {
  const repository = new SurveyResponsesRepository({
    select: () => {
      throw new Error("query_should_not_start");
    },
  });
  await assert.rejects(
    repository.findAnswersByResponseIds(Array.from({ length: 101 }, (_, index) => `response-${index}`)),
    /survey_response_ids_limit_exceeded/,
  );
});

test("bounded fetch rejects a declared response above the byte cap", async () => {
  await withServer((_request, response) => {
    response.setHeader("Content-Length", "9");
    response.end("123456789");
  }, async (url) => {
    await assert.rejects(
      fetchBoundedText({ url, timeoutMs: 1000, maxBytes: 8 }),
      (error) => error instanceof BoundedFetchError && error.code === "external_response_too_large",
    );
  });
});

test("bounded fetch rejects chunked data above the byte cap and private targets when requested", async () => {
  await withServer((_request, response) => {
    response.write("12345");
    setTimeout(() => response.end("67890"), 5);
  }, async (url) => {
    await assert.rejects(
      fetchBoundedText({ url, timeoutMs: 1000, maxBytes: 8 }),
      (error) => error instanceof BoundedFetchError && error.code === "external_response_too_large",
    );
  });

  await assert.rejects(
    fetchBoundedText({
      url: "http://127.0.0.1:1",
      timeoutMs: 1000,
      maxBytes: 8,
      rejectPrivateAddresses: true,
    }),
    (error) => error instanceof BoundedFetchError && error.code === "external_private_address_not_allowed",
  );
});

test("bounded fetch aborts a slow provider", async () => {
  await withServer((_request, response) => {
    setTimeout(() => response.end("late"), 100);
  }, async (url) => {
    await assert.rejects(
      fetchBoundedText({ url, timeoutMs: 20, maxBytes: 32 }),
      (error) => error instanceof BoundedFetchError && error.code === "external_fetch_failed",
    );
  });
});
