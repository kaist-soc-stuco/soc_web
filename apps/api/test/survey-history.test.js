const assert = require("node:assert/strict");
const { test, before, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq, inArray } = require("drizzle-orm");
const { RestoreSurveyStructureSchema, surveyStructureSnapshot, surveyStructuresEqual } = require("@soc/contracts");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { SurveyHistoryService } = require(base + "features/surveys/survey-history.service.js");
const { SurveyMutationPolicy } = require(base + "features/surveys/survey-mutation-policy.js");
const { SurveySectionsRepository } = require(base + "features/surveys/survey-sections.repository.js");
const { SurveyQuestionsRepository } = require(base + "features/surveys/survey-questions.repository.js");
const enabled = Boolean(process.env.SURVEY_HISTORY_TEST_DATABASE_URL || process.env.SURVEY_HISTORY_TEST_LOCAL);
let pool, db, service, sections, questions;
const ids = [], actor = randomUUID();
before(async () => {
  if (!enabled) return;
  pool = new Pool(process.env.SURVEY_HISTORY_TEST_DATABASE_URL ? { connectionString: process.env.SURVEY_HISTORY_TEST_DATABASE_URL } : {
    host: "localhost", port: 5432, database: process.env.POSTGRES_DB || "soc_web", user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
  });
  db = drizzle(pool, { schema });
  sections = new SurveySectionsRepository(db); questions = new SurveyQuestionsRepository(db);
  service = new SurveyHistoryService(new SurveyMutationPolicy(db), sections, questions, undefined, { record: async () => {} });
});
after(async () => {
  if (!db) return;
  try {
    for (const id of ids) await db.delete(schema.surveyResponses).where(eq(schema.surveyResponses.surveyId, id));
    if (ids.length) await db.delete(schema.surveys).where(inArray(schema.surveys.surveyId, ids));
  } finally { await pool.end(); }
});
async function fixture() {
  const [row] = await db.insert(schema.surveys).values({ titleKo: "History QA", kind: "SURVEY", isPublished: true, lifecycleStatus: "PUBLISHED", isAlwaysOpen: true }).returning();
  ids.push(row.surveyId);
  const [section] = await db.insert(schema.surveySections).values({ surveyId: row.surveyId, titleKo: "First" }).returning();
  await db.insert(schema.surveyQuestions).values({ sectionId: section.id, titleKo: "Original", questionType: "short_text", isRequired: false });
  return row.surveyId;
}
async function read(id) {
  return surveyStructureSnapshot(await Promise.all((await sections.findBySurveyId(id)).map(async s => ({ ...s, questions: await questions.findBySectionId(s.id) }))));
}
const opts = { skip: !enabled };
test("structure schema rejects repeated IDs and publication fields", () => {
  const id = randomUUID();
  assert.equal(RestoreSurveyStructureSchema.safeParse({ expected: [], sections: [{ id, titleKo: "", questions: [] }, { id, titleKo: "", questions: [] }] }).success, false);
  assert.equal(RestoreSurveyStructureSchema.safeParse({ expected: [], sections: [], isPublished: false }).success, false);
});
test("structure comparisons ignore timestamps and JSON object key ordering", () => {
  const s = { id: randomUUID(), titleKo: "Section", questions: [{ id: randomUUID(), titleKo: "Q", questionType: "rating", config: { ratingMax: 5, ratingIcon: "star" } }] };
  const t = structuredClone(s); t.updatedAt = "new"; t.questions[0].config = { ratingIcon: "star", ratingMax: 5 };
  assert.ok(surveyStructuresEqual([s], [t]));
});
test("add, remove, reorder and redo preserve IDs and section branching", opts, async () => {
  const id = await fixture(), original = await read(id);
  const next = structuredClone(original);
  const secondId = randomUUID();
  next.push({ ...next[0], id: secondId, titleKo: "Second", sortOrder: 1, questions: [{ ...next[0].questions[0], id: randomUUID() }] });
  next[0].nextSectionId = secondId;
  await service.restore(id, { expected: original, sections: next }, actor);
  const added = await read(id);
  await service.restore(id, { expected: added, sections: original }, actor);
  assert.ok(surveyStructuresEqual(await read(id), original));
  await service.restore(id, { expected: original, sections: added }, actor);
  assert.ok(surveyStructuresEqual(await read(id), added));
  const reordered = structuredClone(added).reverse(); reordered.forEach(s => s.nextSectionId = null);
  await service.restore(id, { expected: added, sections: reordered }, actor);
  assert.deepEqual((await read(id)).map(s => s.id), reordered.map(s => s.id));
  const [survey] = await db.select().from(schema.surveys).where(eq(schema.surveys.surveyId, id));
  assert.equal(survey.isPublished, true);
});
test("stale history and foreign IDs cannot overwrite another edit or survey", opts, async () => {
  const id = await fixture(), otherId = await fixture(), initial = await read(id), foreign = await read(otherId);
  await assert.rejects(service.restore(id, { expected: [], sections: initial }, actor), /survey_history_conflict/);
  await assert.rejects(service.restore(id, { expected: initial, sections: foreign }, actor), /survey_history_id_conflict/);
  assert.ok(surveyStructuresEqual(await read(id), initial));
  assert.ok(surveyStructuresEqual(await read(otherId), foreign));
});
test("invalid branching rolls back the complete restore", opts, async () => {
  const id = await fixture(), initial = await read(id), invalid = structuredClone(initial);
  invalid[0].titleKo = "Must roll back"; invalid[0].nextSectionId = randomUUID();
  await assert.rejects(service.restore(id, { expected: initial, sections: invalid }, actor));
  assert.ok(surveyStructuresEqual(await read(id), initial));
});
test("existing answers survive edits and block undo that would delete their question", opts, async () => {
  const id = await fixture(), initial = await read(id);
  const [response] = await db.insert(schema.surveyResponses).values({ surveyId: id, status: "submitted" }).returning();
  const [answer] = await db.insert(schema.surveyAnswers).values({ responseId: response.id, questionId: initial[0].questions[0].id, content: { value: "keep" } }).returning();
  const modified = structuredClone(initial); modified[0].questions[0].titleKo = "Changed";
  await service.restore(id, { expected: initial, sections: modified }, actor);
  await service.restore(id, { expected: await read(id), sections: initial }, actor);
  await assert.rejects(service.restore(id, { expected: initial, sections: [] }, actor), /survey_history_question_has_answers/);
  const [preserved] = await db.select().from(schema.surveyAnswers).where(eq(schema.surveyAnswers.id, answer.id));
  assert.deepEqual(preserved.content, { value: "keep" });
});
test("header and structure restore together without unpublishing", opts, async () => {
  const id = await fixture(), initial = await read(id), changed = structuredClone(initial);
  changed[0].titleKo = "New heading";
  const expected = { titleKo: "History QA", titleEn: "", descriptionKo: "", descriptionEn: "" };
  await service.restore(id, { expected: initial, sections: changed, header: { expected, value: { ...expected, titleKo: "New heading" } } }, actor);
  const [survey] = await db.select().from(schema.surveys).where(eq(schema.surveys.surveyId, id));
  assert.equal(survey.titleKo, "New heading"); assert.equal(survey.isPublished, true);
});
