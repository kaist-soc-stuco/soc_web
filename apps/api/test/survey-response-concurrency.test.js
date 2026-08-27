const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const {
  BadRequestException,
  NotFoundException,
} = require("@nestjs/common");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const {
  SurveyMutationPolicy,
} = require("../dist/apps/api/src/features/surveys/survey-mutation-policy.js");
const {
  SurveyQuestionsRepository,
} = require("../dist/apps/api/src/features/surveys/survey-questions.repository.js");
const {
  SurveyQuestionsService,
} = require("../dist/apps/api/src/features/surveys/survey-questions.service.js");
const {
  SurveyResponsesRepository,
} = require("../dist/apps/api/src/features/surveys/survey-responses.repository.js");
const {
  SurveyResponsesService,
} = require("../dist/apps/api/src/features/surveys/survey-responses.service.js");
const {
  SurveySectionsRepository,
} = require("../dist/apps/api/src/features/surveys/survey-sections.repository.js");
const {
  SurveysRepository,
} = require("../dist/apps/api/src/features/surveys/surveys.repository.js");
const {
  SurveysService,
} = require("../dist/apps/api/src/features/surveys/surveys.service.js");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");

const databaseUrl = process.env.SURVEY_CONCURRENCY_TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) {
  throw new Error("SURVEY_CONCURRENCY_TEST_DATABASE_URL_is_required_in_CI");
}
const integrationOptions = { skip: !databaseUrl };

const USER_ONE = "00000000-0000-4000-8000-000000000001";
const USER_TWO = "00000000-0000-4000-8000-000000000002";
const SINGLE_SURVEY = "10000000-0000-4000-8000-000000000001";
const MULTIPLE_SURVEY = "10000000-0000-4000-8000-000000000002";
const CAPACITY_SURVEY = "10000000-0000-4000-8000-000000000003";
const DELETE_SURVEY = "10000000-0000-4000-8000-000000000005";
const STRUCTURE_SURVEY = "10000000-0000-4000-8000-000000000006";
const STATE_SURVEY = "10000000-0000-4000-8000-000000000007";
const DUPLICATE_SURVEY = "10000000-0000-4000-8000-000000000008";
const RESPONSE_FIRST_SURVEY = "10000000-0000-4000-8000-000000000009";
const RESPONSE_INSERT_ADVISORY_LOCK = 7815501;

let pool;
let db;
let responsesRepository;
let surveysRepository;
let sectionsRepository;
let questionsRepository;
let mutationPolicy;

before(async () => {
  if (!databaseUrl) return;

  pool = new Pool({ connectionString: databaseUrl, max: 10 });
  db = drizzle(pool, { schema });
  responsesRepository = new SurveyResponsesRepository(db);
  surveysRepository = new SurveysRepository(db);
  sectionsRepository = new SurveySectionsRepository(db);
  questionsRepository = new SurveyQuestionsRepository(db);
  mutationPolicy = new SurveyMutationPolicy(db);
});

beforeEach(async () => {
  if (!pool) return;

  await pool.query("TRUNCATE TABLE users, survey RESTART IDENTITY CASCADE");
  await pool.query(
    `INSERT INTO users (user_id, kaist_uid, name_ko, email)
     VALUES ($1, 'user-one', 'User One', 'user-one@example.com'),
            ($2, 'user-two', 'User Two', 'user-two@example.com')`,
    [USER_ONE, USER_TWO],
  );
});

after(async () => {
  await pool?.end();
});

async function insertSurvey({
  id,
  allowMultipleResponses = false,
  allowResponseEdit = false,
  maxResponseCount = null,
  isPublished = true,
  isAlwaysOpen = true,
  openAt = null,
  closeAt = null,
  resultVisibility = "PRIVATE",
  connectedArticleId = null,
  showOnCalendar = false,
  creatorId = USER_ONE,
}) {
  await pool.query(
    `INSERT INTO survey (
       survey_id, creator_id, kind, title_ko, result_visibility,
       allow_multiple_responses, allow_response_edit, max_response_count,
       is_published, lifecycle_status, is_always_open, open_at, close_at,
       connected_article_id, show_on_calendar
     ) VALUES ($1, $2, 'SURVEY', 'Concurrency test', $3, $4, $5, $6,
               $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      creatorId,
      resultVisibility,
      allowMultipleResponses,
      allowResponseEdit,
      maxResponseCount,
      isPublished,
      isPublished ? "PUBLISHED" : "DRAFT",
      isAlwaysOpen,
      openAt,
      closeAt,
      connectedArticleId,
      showOnCalendar,
    ],
  );
}

async function submit(surveyId, userId, answers = []) {
  return responsesRepository.insertSubmission({ surveyId, userId, answers });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function assertStillPending(promise) {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(settled, false, "operation should wait for the survey row lock");
}

async function waitForAdvisoryLockWaiter(timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS count
       FROM pg_locks
       WHERE locktype = 'advisory' AND granted = false`,
    );
    if (rows[0].count > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("timed_out_waiting_for_response_insert_lock");
}

function createSurveysService(policy = mutationPolicy, questionsRepo = questionsRepository) {
  return new SurveysService(
    surveysRepository,
    sectionsRepository,
    questionsRepo,
    responsesRepository,
    policy,
  );
}

test(
  "serializes concurrent submissions from one user for a single-response survey",
  integrationOptions,
  async () => {
    await insertSurvey({
      id: SINGLE_SURVEY,
      allowMultipleResponses: false,
      maxResponseCount: 1,
    });

    const outcomes = await Promise.all([
      submit(SINGLE_SURVEY, USER_ONE),
      submit(SINGLE_SURVEY, USER_ONE),
    ]);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id = $1",
      [SINGLE_SURVEY],
    );
    assert.equal(rows[0].count, 1);
    assert.deepEqual(
      outcomes.map((outcome) => outcome.status).sort(),
      ["already_submitted", "created"],
    );
  },
);

test(
  "keeps repeated submissions enabled when allow_multiple_responses is true",
  integrationOptions,
  async () => {
    await insertSurvey({ id: MULTIPLE_SURVEY, allowMultipleResponses: true });

    const outcomes = await Promise.all([
      submit(MULTIPLE_SURVEY, USER_ONE),
      submit(MULTIPLE_SURVEY, USER_ONE),
    ]);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS count,
              count(single_response_user_id)::int AS keyed_count
       FROM survey_responses
       WHERE survey_id = $1`,
      [MULTIPLE_SURVEY],
    );
    assert.deepEqual(rows[0], { count: 2, keyed_count: 0 });
    assert.deepEqual(
      outcomes.map((outcome) => outcome.status),
      ["created", "created"],
    );
  },
);

test(
  "admits only one concurrent submission into the final capacity slot",
  integrationOptions,
  async () => {
    await insertSurvey({
      id: CAPACITY_SURVEY,
      allowMultipleResponses: true,
      maxResponseCount: 1,
    });

    const outcomes = await Promise.all([
      submit(CAPACITY_SURVEY, USER_ONE),
      submit(CAPACITY_SURVEY, USER_TWO),
    ]);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id = $1",
      [CAPACITY_SURVEY],
    );
    assert.equal(rows[0].count, 1);
    assert.deepEqual(
      outcomes.map((outcome) => outcome.status).sort(),
      ["capacity_full", "created"],
    );
  },
);

test(
  "enforces the single-response key with a database unique index",
  integrationOptions,
  async () => {
    await insertSurvey({ id: SINGLE_SURVEY });
    const outcome = await submit(SINGLE_SURVEY, USER_ONE);
    assert.equal(outcome.status, "created");

    await assert.rejects(
      pool.query(
        `INSERT INTO survey_responses (
           survey_id, user_id, single_response_user_id, status, submitted_at
         ) VALUES ($1, $2, $2, 'submitted', now())`,
        [SINGLE_SURVEY, USER_ONE],
      ),
      (error) => {
        assert.equal(error.code, "23505");
        assert.equal(
          error.constraint,
          "survey_responses_single_response_user_unique_idx",
        );
        return true;
      },
    );
  },
);

test(
  "hard deletion commits before a stale submission and leaves no orphan response",
  integrationOptions,
  async () => {
    await insertSurvey({ id: DELETE_SURVEY, isPublished: true });
    const entered = deferred();
    const release = deferred();
    const pausingPolicy = {
      withHardDelete: (surveyId, mutation) =>
        mutationPolicy.withHardDelete(surveyId, async (tx) => {
          entered.resolve();
          await release.promise;
          return mutation(tx);
        }),
    };
    const surveysService = createSurveysService(pausingPolicy);

    const deletePromise = surveysService.delete(DELETE_SURVEY);
    await entered.promise;
    const submissionPromise = submit(DELETE_SURVEY, USER_ONE);

    try {
      await assertStillPending(submissionPromise);
    } finally {
      release.resolve();
    }

    const [, submission] = await Promise.all([
      deletePromise,
      submissionPromise,
    ]);
    assert.equal(submission.status, "survey_not_found");
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM survey WHERE survey_id = $1) AS surveys,
         (SELECT count(*)::int FROM survey_responses WHERE survey_id = $1) AS responses`,
      [DELETE_SURVEY],
    );
    assert.deepEqual(rows[0], { surveys: 0, responses: 0 });
  },
);

test(
  "a stale submission revalidates questions after a concurrent structure mutation",
  integrationOptions,
  async () => {
    await insertSurvey({ id: STRUCTURE_SURVEY });
    const { rows: sectionRows } = await pool.query(
      `INSERT INTO survey_sections (survey_id, title_ko)
       VALUES ($1, 'Section') RETURNING id`,
      [STRUCTURE_SURVEY],
    );
    const sectionId = sectionRows[0].id;
    const entered = deferred();
    const release = deferred();
    const pausingPolicy = {
      withStructureMutation: (surveyId, mutation) =>
        mutationPolicy.withStructureMutation(surveyId, async (tx) => {
          entered.resolve();
          await release.promise;
          return mutation(tx);
        }),
    };
    const questionsService = new SurveyQuestionsService(
      questionsRepository,
      sectionsRepository,
      pausingPolicy,
    );

    const questionPromise = questionsService.create(
      STRUCTURE_SURVEY,
      sectionId,
      {
        titleKo: "New required question",
        questionType: "short_text",
        isRequired: true,
      },
    );
    await entered.promise;
    const submissionPromise = submit(STRUCTURE_SURVEY, USER_ONE);

    try {
      await assertStillPending(submissionPromise);
    } finally {
      release.resolve();
    }

    await questionPromise;
    await assert.rejects(submissionPromise, (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.message, "required_answer_missing");
      return true;
    });
    const { rows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id = $1",
      [STRUCTURE_SURVEY],
    );
    assert.equal(rows[0].count, 0);
  },
);

test(
  "a first response commits before a waiting structure mutation, which then proceeds",
  integrationOptions,
  async () => {
    await insertSurvey({ id: RESPONSE_FIRST_SURVEY });
    const { rows: sectionRows } = await pool.query(
      `INSERT INTO survey_sections (survey_id, title_ko)
       VALUES ($1, 'Section') RETURNING id`,
      [RESPONSE_FIRST_SURVEY],
    );
    const sectionId = sectionRows[0].id;
    const blocker = await pool.connect();
    let advisoryLockHeld = false;
    let submissionPromise;
    let mutationPromise;

    try {
      await pool.query(
        `CREATE OR REPLACE FUNCTION gate0_block_survey_response_insert()
         RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN
           PERFORM pg_advisory_xact_lock(${RESPONSE_INSERT_ADVISORY_LOCK});
           RETURN NEW;
         END
         $$`,
      );
      await pool.query(
        `CREATE TRIGGER gate0_block_survey_response_insert
         BEFORE INSERT ON survey_responses
         FOR EACH ROW EXECUTE FUNCTION gate0_block_survey_response_insert()`,
      );
      await blocker.query(
        "SELECT pg_advisory_lock($1::bigint)",
        [RESPONSE_INSERT_ADVISORY_LOCK],
      );
      advisoryLockHeld = true;

      submissionPromise = submit(RESPONSE_FIRST_SURVEY, USER_ONE);
      await waitForAdvisoryLockWaiter();

      const questionsService = new SurveyQuestionsService(
        questionsRepository,
        sectionsRepository,
        mutationPolicy,
      );
      mutationPromise = questionsService.create(
        RESPONSE_FIRST_SURVEY,
        sectionId,
        {
          titleKo: "Must not be added after the first response",
          questionType: "short_text",
          isRequired: true,
        },
      );
      await assertStillPending(mutationPromise);

      await blocker.query(
        "SELECT pg_advisory_unlock($1::bigint)",
        [RESPONSE_INSERT_ADVISORY_LOCK],
      );
      advisoryLockHeld = false;

      const submission = await submissionPromise;
      assert.equal(submission.status, "created");
      const createdQuestion = await mutationPromise;
      assert.equal(
        createdQuestion.titleKo,
        "Must not be added after the first response",
      );
      const { rows } = await pool.query(
        "SELECT count(*)::int AS count FROM survey_questions WHERE section_id = $1",
        [sectionId],
      );
      assert.equal(rows[0].count, 1);
    } finally {
      if (advisoryLockHeld) {
        await blocker.query(
          "SELECT pg_advisory_unlock($1::bigint)",
          [RESPONSE_INSERT_ADVISORY_LOCK],
        );
      }
      await Promise.allSettled(
        [submissionPromise, mutationPromise].filter(Boolean),
      );
      await pool.query(
        "DROP TRIGGER IF EXISTS gate0_block_survey_response_insert ON survey_responses",
      );
      await pool.query(
        "DROP FUNCTION IF EXISTS gate0_block_survey_response_insert()",
      );
      blocker.release();
    }
  },
);

test(
  "submit and updateMine map authoritative database state instead of trusting stale service reads",
  integrationOptions,
  async () => {
    await insertSurvey({
      id: STATE_SURVEY,
      allowResponseEdit: true,
      isPublished: true,
    });
    const created = await submit(STATE_SURVEY, USER_ONE);
    assert.equal(created.status, "created");

    const staleSurvey = await surveysRepository.findById(STATE_SURVEY);
    assert.equal(staleSurvey.isPublished, true);
    await pool.query(
      `UPDATE survey
       SET is_published = false, lifecycle_status = 'DRAFT'
       WHERE survey_id = $1`,
      [STATE_SURVEY],
    );

    const staleSurveyLookup = {
      findById: async () => staleSurvey,
    };
    const usersService = {
      getStudentFeeStatus: async () => ({ status: "PAID" }),
    };
    const service = new SurveyResponsesService(
      responsesRepository,
      staleSurveyLookup,
      usersService,
    );

    await assert.rejects(
      service.submit(STATE_SURVEY, { answers: [] }, {
        id: USER_TWO,
        permission: 0,
      }),
      (error) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "survey_not_found");
        return true;
      },
    );
    await assert.rejects(
      service.updateMine(STATE_SURVEY, { answers: [] }, {
        id: USER_ONE,
        permission: 0,
      }),
      (error) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "survey_not_found");
        return true;
      },
    );

    const { rows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id = $1",
      [STATE_SURVEY],
    );
    assert.equal(rows[0].count, 1);
  },
);

test(
  "authoritative submission checks enforce opening and closing times under the row lock",
  integrationOptions,
  async () => {
    const future = new Date(Date.now() + 60_000);
    await insertSurvey({
      id: STATE_SURVEY,
      isAlwaysOpen: false,
      openAt: future,
      closeAt: new Date(future.valueOf() + 60_000),
    });
    assert.equal(
      (await submit(STATE_SURVEY, USER_ONE)).status,
      "survey_not_open_yet",
    );

    await pool.query(
      "UPDATE survey SET open_at = now() - interval '2 minutes', close_at = now() - interval '1 minute' WHERE survey_id = $1",
      [STATE_SURVEY],
    );
    assert.equal((await submit(STATE_SURVEY, USER_ONE)).status, "survey_closed");
  },
);

test(
  "duplicates a survey as a private unlinked version and rolls back partial copies",
  integrationOptions,
  async () => {
    const { rows: boardRows } = await pool.query(
      `INSERT INTO board (code, name_ko)
       VALUES ('duplicate-test', 'Duplicate Test')
       ON CONFLICT (code) DO UPDATE SET name_ko = EXCLUDED.name_ko
       RETURNING board_id`,
    );
    const { rows: articleRows } = await pool.query(
      `INSERT INTO article (board_id, author_user_id, title_ko, content_ko)
       VALUES ($1, $2, 'Linked article', 'Body') RETURNING article_id`,
      [boardRows[0].board_id, USER_ONE],
    );
    await insertSurvey({
      id: DUPLICATE_SURVEY,
      isPublished: false,
      resultVisibility: "PUBLIC",
      connectedArticleId: articleRows[0].article_id,
      showOnCalendar: true,
    });
    const { rows: sectionRows } = await pool.query(
      `INSERT INTO survey_sections (survey_id, title_ko)
       VALUES ($1, 'Original section') RETURNING id`,
      [DUPLICATE_SURVEY],
    );
    await pool.query(
      `INSERT INTO survey_questions (
         section_id, title_ko, question_type, edit_deadline_at
       ) VALUES ($1, 'Original question', 'short_text', now() + interval '1 day')`,
      [sectionRows[0].id],
    );
    await pool.query(
      `INSERT INTO survey_responses (
         survey_id, user_id, single_response_user_id, status, submitted_at
       ) VALUES ($1, $2, $2, 'submitted', now())`,
      [DUPLICATE_SURVEY, USER_ONE],
    );

    const surveysService = createSurveysService();
    const duplicated = await surveysService.duplicate(
      DUPLICATE_SURVEY,
      USER_TWO,
    );
    assert.equal(duplicated.isPublished, false);
    assert.equal(duplicated.lifecycleStatus, "DRAFT");
    assert.equal(duplicated.previousVersionId, DUPLICATE_SURVEY);
    assert.equal(duplicated.versionNumber, 2);
    assert.equal(duplicated.resultVisibility, "PRIVATE");
    assert.equal(duplicated.connectedPostId, null);
    assert.equal(duplicated.showOnCalendar, false);
    assert.equal(duplicated.responseCount, 0);

    const { rows: copiedRows } = await pool.query(
      `SELECT s.is_published, s.lifecycle_status, s.previous_version_id,
              s.version_number, s.result_visibility, s.connected_article_id,
              s.show_on_calendar, q.edit_deadline_at
       FROM survey s
       JOIN survey_sections ss ON ss.survey_id = s.survey_id
       JOIN survey_questions q ON q.section_id = ss.id
       WHERE s.survey_id = $1`,
      [duplicated.id],
    );
    assert.deepEqual(copiedRows[0], {
      is_published: false,
      lifecycle_status: "DRAFT",
      previous_version_id: DUPLICATE_SURVEY,
      version_number: 2,
      result_visibility: "PRIVATE",
      connected_article_id: null,
      show_on_calendar: false,
      edit_deadline_at: null,
    });

    await pool.query(
      "DELETE FROM survey_responses WHERE survey_id = $1",
      [DUPLICATE_SURVEY],
    );

    const { rows: beforeFailureRows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey",
    );
    const failingQuestionsRepository = {
      findBySectionId: (...args) =>
        questionsRepository.findBySectionId(...args),
      insert: async () => {
        throw new Error("copy_question_failed");
      },
    };
    const failingService = createSurveysService(
      mutationPolicy,
      failingQuestionsRepository,
    );
    await assert.rejects(
      failingService.duplicate(DUPLICATE_SURVEY, USER_TWO),
      /copy_question_failed/,
    );
    const { rows: afterFailureRows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey",
    );
    assert.equal(afterFailureRows[0].count, beforeFailureRows[0].count);

    await surveysService.delete(DUPLICATE_SURVEY);
    const { rows: afterDeleteRows } = await pool.query(
      "SELECT count(*)::int AS count FROM survey WHERE survey_id = $1",
      [DUPLICATE_SURVEY],
    );
    assert.equal(afterDeleteRows[0].count, 0);
  },
);
