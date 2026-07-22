const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} = require("@nestjs/common");

const {
  SurveyResponsesService,
} = require("../dist/apps/api/src/features/surveys/survey-responses.service.js");

const PAST_ISO = "2000-01-01T00:00:00.000Z";
const FUTURE_ISO = "2999-01-01T00:00:00.000Z";
const NOWISH_ISO = "2026-05-30T00:00:00.000Z";

const caller = { id: "user-1", permission: 0 };
const validDto = {
  answers: [{ questionId: "question-1", content: { text: "홍길동" } }],
};

function survey(overrides = {}) {
  return {
    id: "survey-1",
    isPublished: true,
    opensAt: null,
    closesAt: null,
    allowMultipleResponses: false,
    allowResponseEdit: false,
    feePayersOnly: false,
    maxResponses: null,
    ...overrides,
  };
}

function createService({
  existingResponse = null,
  feeStatus = { status: "PAID" },
  insertSubmissionStatus = "created",
  surveyRecord = survey(),
} = {}) {
  const insertSubmissionCalls = [];
  const updateSubmissionCalls = [];

  const responsesRepo = {
    findBySurveyId: async () => [],
    findByUserAndSurvey: async () => existingResponse,
    findAnswersByResponseId: async () => [],
    insertSubmission: async (input) => {
      insertSubmissionCalls.push(input);
      if (insertSubmissionStatus !== "created") {
        return { status: insertSubmissionStatus };
      }
      return {
        status: "created",
        response: {
          id: "response-1",
          surveyId: input.surveyId,
          userId: input.userId,
          status: "submitted",
          submittedAt: NOWISH_ISO,
          user: null,
          createdAt: NOWISH_ISO,
          updatedAt: NOWISH_ISO,
        },
        answers: input.answers.map((answer, index) => ({
          id: `answer-${index + 1}`,
          responseId: "response-1",
          questionId: answer.questionId,
          content: answer.content,
          submittedAt: NOWISH_ISO,
          updatedAt: NOWISH_ISO,
        })),
      };
    },
    updateSubmission: async (input) => {
      updateSubmissionCalls.push(input);
      return {
        status: "updated",
        response: {
          id: input.responseId,
          surveyId: input.surveyId,
          userId: caller.id,
          status: "submitted",
          submittedAt: NOWISH_ISO,
          user: null,
          createdAt: NOWISH_ISO,
          updatedAt: NOWISH_ISO,
        },
        answers: input.answers.map((answer, index) => ({
          id: `updated-answer-${index + 1}`,
          responseId: input.responseId,
          questionId: answer.questionId,
          content: answer.content,
          submittedAt: NOWISH_ISO,
          updatedAt: NOWISH_ISO,
        })),
      };
    },
  };

  const service = new SurveyResponsesService(
    responsesRepo,
    { findById: async () => surveyRecord },
    { getStudentFeeStatus: async () => feeStatus },
  );

  return { insertSubmissionCalls, service, updateSubmissionCalls };
}

async function expectHttpError(promise, ExceptionClass, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ExceptionClass);
    assert.equal(error.message, message);
    return true;
  });
}

test("rejects unpublished surveys as not found", async () => {
  const { insertSubmissionCalls, service } = createService({
    surveyRecord: survey({ isPublished: false }),
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    NotFoundException,
    "survey_not_found",
  );
  assert.equal(insertSubmissionCalls.length, 0);
});

test("rejects submissions before opening time", async () => {
  const { insertSubmissionCalls, service } = createService({
    surveyRecord: survey({ opensAt: FUTURE_ISO }),
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    ConflictException,
    "survey_not_open_yet",
  );
  assert.equal(insertSubmissionCalls.length, 0);
});

test("rejects submissions after closing time", async () => {
  const { insertSubmissionCalls, service } = createService({
    surveyRecord: survey({ closesAt: PAST_ISO }),
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    ConflictException,
    "survey_closed",
  );
  assert.equal(insertSubmissionCalls.length, 0);
});

test("requires a logged-in caller", async () => {
  const { insertSubmissionCalls, service } = createService();

  await expectHttpError(
    service.submit("survey-1", validDto),
    ForbiddenException,
    "login_required",
  );
  assert.equal(insertSubmissionCalls.length, 0);
});

test("maps the transactional duplicate outcome to a conflict", async () => {
  const { insertSubmissionCalls, service } = createService({
    insertSubmissionStatus: "already_submitted",
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    ConflictException,
    "already_submitted",
  );
  assert.equal(insertSubmissionCalls.length, 1);
});

test("requires backend-confirmed fee payment for fee-payer-only surveys", async () => {
  const { insertSubmissionCalls, service } = createService({
    feeStatus: { status: "UNPAID" },
    surveyRecord: survey({ feePayersOnly: true }),
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    ForbiddenException,
    "fee_payer_only",
  );
  assert.equal(insertSubmissionCalls.length, 0);
});

test("rejects submissions once capacity is full", async () => {
  const { insertSubmissionCalls, service } = createService({
    insertSubmissionStatus: "capacity_full",
    surveyRecord: survey({ maxResponses: 10 }),
  });

  await expectHttpError(
    service.submit("survey-1", validDto, caller),
    ConflictException,
    "survey_capacity_full",
  );
  assert.equal(insertSubmissionCalls.length, 1);
});

test("stores valid submissions with the authenticated user id", async () => {
  const { insertSubmissionCalls, service } = createService({
    surveyRecord: survey({ feePayersOnly: true, maxResponses: 10 }),
  });

  const result = await service.submit("survey-1", validDto, caller);

  assert.equal(insertSubmissionCalls.length, 1);
  assert.deepEqual(insertSubmissionCalls[0], {
    surveyId: "survey-1",
    userId: "user-1",
    answers: validDto.answers,
  });
  assert.equal(result.id, "response-1");
  assert.equal(result.answers.length, 1);
});

test("rejects response edits when the survey does not allow editing", async () => {
  const { service, updateSubmissionCalls } = createService({
    existingResponse: { id: "existing-response" },
  });

  await expectHttpError(
    service.updateMine("survey-1", validDto, caller),
    ConflictException,
    "response_edit_not_allowed",
  );
  assert.equal(updateSubmissionCalls.length, 0);
});

test("updates the caller's existing response when editing is allowed", async () => {
  const { service, updateSubmissionCalls } = createService({
    existingResponse: { id: "existing-response" },
    surveyRecord: survey({ allowResponseEdit: true }),
  });

  const result = await service.updateMine("survey-1", validDto, caller);

  assert.equal(updateSubmissionCalls.length, 1);
  assert.deepEqual(updateSubmissionCalls[0], {
    responseId: "existing-response",
    surveyId: "survey-1",
    userId: "user-1",
    answers: validDto.answers,
  });
  assert.equal(result.id, "existing-response");
  assert.equal(result.answers.length, 1);
});
