const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { eq, inArray } = require("drizzle-orm");
const path = require("node:path");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { AssetRepository } = require(base + "features/asset/repositories/asset.repository.js");
const { SurveysRepository } = require(base + "features/surveys/surveys.repository.js");
const { SurveySectionsRepository } = require(base + "features/surveys/survey-sections.repository.js");
const { SurveyQuestionsRepository } = require(base + "features/surveys/survey-questions.repository.js");
const { SurveyMutationPolicy } = require(base + "features/surveys/survey-mutation-policy.js");
const { SurveysService } = require(base + "features/surveys/surveys.service.js");
const { SurveySectionsService } = require(base + "features/surveys/survey-sections.service.js");
const { SurveyQuestionsService } = require(base + "features/surveys/survey-questions.service.js");
const { VotesRepository } = require(base + "features/votes/votes.repository.js");
const { VotesService } = require(base + "features/votes/votes.service.js");
const url = process.env.PERMISSION_ASSET_TEST_DATABASE_URL;
const opts = { skip: !url };
const creator = randomUUID(), manager = randomUUID();
let pool, db, assets, surveys, sections, questions, surveyService, sectionService, questionService, voteService;
before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });
  for (const id of [creator, manager]) await db.insert(schema.users).values({ userId: id, kaistUid: id.slice(0, 20), nameKo: "권한 검증", email: `${id}@example.test`, isActive: true });
  assets = new AssetRepository(db);
  surveys = new SurveysRepository(db);
  sections = new SurveySectionsRepository(db);
  questions = new SurveyQuestionsRepository(db);
  const policy = new SurveyMutationPolicy(db);
  surveyService = new SurveysService(surveys, sections, questions, {}, policy, undefined, undefined, undefined, assets);
  sectionService = new SurveySectionsService(sections, policy, questions, undefined, assets);
  questionService = new SurveyQuestionsService(questions, sections, policy, undefined, assets);
  voteService = new VotesService(new VotesRepository(db), {}, assets);
});
after(async () => {
  if (!db) return;
  try {
    await db.delete(schema.votes).where(inArray(schema.votes.creatorId, [creator, manager]));
    await db.delete(schema.surveys).where(inArray(schema.surveys.creatorId, [creator, manager]));
    await db.delete(schema.assets).where(inArray(schema.assets.uploadedBy, [creator, manager]));
    await db.delete(schema.users).where(inArray(schema.users.userId, [creator, manager]));
  } finally { await pool.end(); }
});
async function image() {
  return (await assets.createAsset({ uploadedBy: creator, storageKey: `fixture:${randomUUID()}`, originalFilename: "image.png", mimeType: "image/png", sizeBytes: 1 })).assetId;
}
async function survey(header) {
  const [row] = await db.insert(schema.surveys).values({ creatorId: creator, titleKo: "설문", kind: "SURVEY", isKoreanOnly: true, isAlwaysOpen: true, descriptionImageUrlKo: header ? `asset:${header}` : null }).returning();
  const [section] = await db.insert(schema.surveySections).values({ surveyId: row.surveyId, titleKo: "섹션" }).returning();
  return { id: row.surveyId, sectionId: section.id };
}
const question = (assetId) => ({ titleKo: "문항", questionType: "single_choice", isRequired: false, options: [{ value: "a", labelKo: "보기", imageUrlKo: `asset:${assetId}` }] });
test("another survey manager can save and publish a draft with existing header/question images", opts, async () => {
  const id = await image();
  const target = await survey(id);
  await questionService.create(target.id, target.sectionId, question(id), creator);
  await surveyService.update(target.id, { titleKo: "인계받은 설문" }, manager);
  const published = await surveyService.update(target.id, { isPublished: true }, manager);
  assert.equal(published.isPublished, true);
  assert.equal((await assets.findAssetWithLinks(id)).publicContentImage, true);
});
test("unrelated private assets are rejected before question or section writes", opts, async () => {
  const privateId = await image();
  const target = await survey();
  await assert.rejects(questionService.create(target.id, target.sectionId, question(privateId), manager), /survey_asset_not_owned/);
  await assert.rejects(sectionService.create(target.id, { titleKo: "악성", descriptionKo: `/assets/${privateId}/content` }, manager), /survey_asset_not_owned/);
  await assert.rejects(sectionService.update(target.id, target.sectionId, { descriptionKo: `/assets/${privateId}/content` }, manager), /survey_asset_not_owned/);
  assert.equal((await questions.findBySectionId(target.sectionId)).length, 0);
  assert.equal((await sections.findById(target.sectionId, target.id)).descriptionKo, null);
  const existing = await questionService.create(target.id, target.sectionId, { ...question(privateId), options: [{ value: "a", labelKo: "보기" }] }, manager);
  await assert.rejects(questionService.update(target.id, target.sectionId, existing.id, question(privateId), manager), /survey_asset_not_owned/);
  assert.equal(await assets.findSurveyImageReference(privateId, { surveyId: target.id }), false);
});
test("existing draft images can be reused inside the same survey but not another draft", opts, async () => {
  const id = await image(), target = await survey(id), unrelated = await survey();
  await questionService.create(target.id, target.sectionId, question(id), manager);
  assert.equal(await assets.canUseAsSurveyReference(id, manager, undefined, target.id), true);
  assert.equal(await assets.canUseAsSurveyReference(id, manager, undefined, unrelated.id), false);
  const flags = await assets.findAssetWithLinks(id);
  assert.equal(flags.surveyDefinitionImage, true);
  assert.equal(flags.publicContentImage, false);
});
test("published question-only images are reusable and asset IDs do not match a longer prefix", opts, async () => {
  const id = await image(), target = await survey();
  await questionService.create(target.id, target.sectionId, question(id), creator);
  await surveyService.update(target.id, { isPublished: true }, creator);
  assert.equal(await assets.canUseAsSurveyReference(id, manager), true);
  const unrelated = await survey();
  await db.insert(schema.surveyQuestions).values({ sectionId: unrelated.sectionId, titleKo: "prefix", questionType: "short_text", config: { imageUrlKo: `asset:${id}0` } });
  assert.equal(await assets.findSurveyImageReference(id, { surveyId: unrelated.id }), false);
});
function voteInput(assetId) {
  return { titleKo: "투표", startsAt: "2026-09-01T00:00:00Z", endsAt: "2027-09-01T00:00:00Z", academicStatuses: [], feePayersOnly: false,
    items: [{ titleKo: "안건", type: "SINGLE_CHOICE", maxSelections: 1, selectionRule: "max", options: [{ labelKo: "A", imageUrl: `asset:${assetId}` }, { labelKo: "B" }] }] };
}
test("vote images support manager handoff/public response and survive orphan cleanup", opts, async () => {
  const id = await image(), input = voteInput(id);
  const vote = await voteService.create(creator, input);
  await voteService.update(vote.id, { items: input.items }, manager);
  assert.equal((await assets.findAssetWithLinks(id)).voteDefinitionImage, true);
  assert.equal((await assets.findAssetWithLinks(id)).publicVoteImage, false);
  await db.update(schema.votes).set({ status: "PUBLISHED" }).where(eq(schema.votes.voteId, vote.id));
  assert.equal((await assets.findAssetWithLinks(id)).publicVoteImage, true);
  assert.equal(await assets.isStillUnlinked(id), false);
  assert.equal(await assets.deleteUnlinkedAsset(id), null);
  assert.equal((await assets.findUnlinkedAssetsBefore(new Date(Date.now() + 10000), 1000)).some(row => row.assetId === id), false);
});
test("vote create/update cannot publish another user's private upload", opts, async () => {
  const privateId = await image();
  await assert.rejects(voteService.create(manager, voteInput(privateId)), /vote_asset_not_owned/);
  const ownId = await image(), input = voteInput(ownId);
  const vote = await voteService.create(creator, input);
  await assert.rejects(voteService.update(vote.id, { items: voteInput(privateId).items }, manager), /vote_asset_not_owned/);
  assert.equal(await assets.findVoteImageReference(privateId, { voteId: vote.id }), false);
});


