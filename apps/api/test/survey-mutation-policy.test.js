const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SurveyMutationPolicy,
} = require("../dist/apps/api/src/features/surveys/survey-mutation-policy.js");
const {
  SurveysService,
} = require("../dist/apps/api/src/features/surveys/surveys.service.js");
const {
  SurveyQuestionsService,
} = require("../dist/apps/api/src/features/surveys/survey-questions.service.js");
const {
  SurveySectionsService,
} = require("../dist/apps/api/src/features/surveys/survey-sections.service.js");

const NOW = "2026-07-15T00:00:00.000Z";

function survey(overrides = {}) {
  return {
    id: "survey-1",
    kind: "SURVEY",
    resultVisibility: "PUBLIC",
    titleKo: "Existing survey",
    titleEn: "Existing survey",
    descriptionKo: "Existing description",
    descriptionEn: "Existing description",
    creatorId: "creator-1",
    publishedAt: null,
    connectedPostId: null,
    feePayersOnly: false,
    allowMultipleResponses: false,
    allowResponseEdit: false,
    isKoreanOnly: false,
    isPublished: true,
    lifecycleStatus: "PUBLISHED",
    previousVersionId: null,
    versionNumber: 1,
    derivedVersionCount: 0,
    showOnCalendar: true,
    maxResponses: null,
    isAlwaysOpen: true,
    opensAt: null,
    closesAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    responseCount: 1,
    ...overrides,
  };
}

function createPolicyHarness({
  derivedVersionCount = 0,
  lifecycleStatus = "DRAFT",
  responseCount = 0,
  surveyExists = true,
} = {}) {
  const events = [];
  let aggregateReadCount = 0;
  const tx = {
    marker: "policy-transaction",
    select() {
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        for(mode) {
          events.push(`lock:${mode}`);
          return Promise.resolve(
            surveyExists ? [{ id: "survey-1", lifecycleStatus }] : [],
          );
        },
        then(resolve, reject) {
          const isResponseCount = aggregateReadCount === 0;
          aggregateReadCount += 1;
          events.push(isResponseCount ? "count-submitted" : "count-derived");
          return Promise.resolve([{
            count: isResponseCount ? responseCount : derivedVersionCount,
          }]).then(
            resolve,
            reject,
          );
        },
      };
      return chain;
    },
  };
  const db = {
    async transaction(callback) {
      aggregateReadCount = 0;
      events.push("transaction:start");
      try {
        return await callback(tx);
      } finally {
        events.push("transaction:end");
      }
    },
  };

  return { policy: new SurveyMutationPolicy(db), tx, events };
}

test("locks the survey row and mutates in one transaction even after responses", async () => {
  const allowed = createPolicyHarness({ responseCount: 1 });
  const value = await allowed.policy.withStructureMutation(
    "survey-1",
    async (tx) => {
      assert.equal(tx, allowed.tx);
      allowed.events.push("mutation");
      return "created";
    },
  );
  assert.equal(value, "created");
  assert.deepEqual(allowed.events, [
    "transaction:start",
    "lock:update",
    "mutation",
    "transaction:end",
  ]);
});

test("hard deletion uses the survey lock and permits response cleanup", async () => {
  const allowed = createPolicyHarness({
    lifecycleStatus: "PUBLISHED",
    responseCount: 1,
  });
  let deleted = false;
  await allowed.policy.withHardDelete("survey-1", async (tx) => {
    assert.equal(tx, allowed.tx);
    deleted = true;
  });
  assert.equal(deleted, true);
  assert.deepEqual(allowed.events, [
    "transaction:start",
    "lock:update",
    "transaction:end",
  ]);
});

test("question and section services pass the locked transaction to every repository call", async () => {
  const { policy, tx } = createPolicyHarness({ responseCount: 0 });
  const seenTransactions = [];
  const questionsService = new SurveyQuestionsService(
    {
      insert: async (_sectionId, _dto, repositoryTx) => {
        seenTransactions.push(repositoryTx);
        return {
          id: "question-1",
          sectionId: "section-1",
          titleKo: "Question",
          titleEn: null,
          descriptionKo: null,
          descriptionEn: null,
          questionType: "short_text",
          options: null,
          config: null,
          answerRegex: null,
          isRequired: true,
          sortOrder: 0,
        };
      },
    },
    {
      findById: async (_sectionId, _surveyId, repositoryTx) => {
        seenTransactions.push(repositoryTx);
        return { id: "section-1" };
      },
    },
    policy,
  );
  const sectionsService = new SurveySectionsService(
    {
      insert: async (_surveyId, _dto, repositoryTx) => {
        seenTransactions.push(repositoryTx);
        return { id: "section-2" };
      },
    },
    policy,
  );

  await questionsService.create("survey-1", "section-1", {
    titleKo: "Question",
    questionType: "short_text",
  });
  await sectionsService.create("survey-1", { titleKo: "Section" });

  assert.equal(seenTransactions.length, 3);
  assert.ok(seenTransactions.every((repositoryTx) => repositoryTx === tx));
});

test("submitted responses do not freeze question definitions", async () => {
  const { policy } = createPolicyHarness({ responseCount: 1 });
  const repositoryCalls = [];
  const questionsService = new SurveyQuestionsService(
    {
      update: async () => {
        repositoryCalls.push("update");
        return {
          id: "question-1", sectionId: "section-1", titleKo: "Changed question meaning",
          titleEn: null, descriptionKo: null, descriptionEn: null,
          questionType: "short_text", options: null, config: null,
          answerRegex: null, isRequired: true, sortOrder: 0,
        };
      },
      findById: async () => {
        repositoryCalls.push("find");
        return { id: "question-1" };
      },
      delete: async () => repositoryCalls.push("delete"),
    },
    {
      findById: async () => {
        repositoryCalls.push("section");
        return { id: "section-1" };
      },
    },
    policy,
  );

  await questionsService.update(
    "survey-1",
    "section-1",
    "question-1",
    { titleKo: "Changed question meaning" },
  );
  await questionsService.delete("survey-1", "section-1", "question-1");
  assert.deepEqual(repositoryCalls, ["section", "update", "section", "find", "delete"]);
});

test("responded surveys can be hard-deleted", async () => {
  const { policy, tx } = createPolicyHarness({
    lifecycleStatus: "PUBLISHED",
    responseCount: 1,
  });
  let hardDeleteCalled = false;
  const repo = {
    delete: async () => {
      hardDeleteCalled = true;
    },
  };
  const service = new SurveysService(repo, {}, {}, {}, policy);

  await service.delete("survey-1");
  assert.equal(hardDeleteCalled, true);
});

test("update responses preserve the authoritative derived-version count", async () => {
  const current = survey({
    derivedVersionCount: 2,
    isPublished: false,
    lifecycleStatus: "DRAFT",
  });
  const { policy, tx } = createPolicyHarness({ lifecycleStatus: "DRAFT" });
  const service = new SurveysService(
    {
      findById: async (_id, repositoryTx) => {
        assert.equal(repositoryTx, tx);
        return current;
      },
      update: async (_id, dto, repositoryTx) => {
        assert.equal(repositoryTx, tx);
        return {
          ...current,
          derivedVersionCount: 0,
          showOnCalendar: dto.showOnCalendar,
        };
      },
    },
    {},
    {},
    {},
    policy,
  );

  const updated = await service.update(current.id, { showOnCalendar: true });
  assert.equal(updated.derivedVersionCount, 2);
});

test("duplicates draft surveys as a private, unlinked version in one transaction", async () => {
  const original = survey({
    isPublished: false,
    lifecycleStatus: "DRAFT",
    connectedPostId: "42",
    resultVisibility: "PUBLIC",
    responseCount: 4,
  });
  const originalSection = {
    id: "section-1",
    surveyId: original.id,
    titleKo: "Original section",
    titleEn: "Original section",
    descriptionKo: null,
    descriptionEn: null,
    sortOrder: 3,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const originalQuestion = {
    id: "question-1",
    sectionId: originalSection.id,
    titleKo: "Original question",
    titleEn: "Original question",
    descriptionKo: null,
    descriptionEn: null,
    questionType: "short_text",
    options: null,
    answerRegex: null,
    isRequired: true,
    editDeadlineAt: "2026-07-20T00:00:00.000Z",
    sortOrder: 5,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const { policy, tx, events } = createPolicyHarness({ responseCount: 4 });
  const seenTransactions = [];
  let createSurveyInput;
  let createSurveyLineage;
  let createQuestionInput;
  const repo = {
    findById: async (_id, repositoryTx) => {
      seenTransactions.push(repositoryTx);
      return original;
    },
    insert: async (_creatorId, dto, repositoryTx, lineage) => {
      seenTransactions.push(repositoryTx);
      createSurveyInput = dto;
      createSurveyLineage = lineage;
      return survey({
        id: "survey-copy",
        creatorId: "manager-2",
        titleKo: dto.titleKo,
        titleEn: dto.titleEn ?? null,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        feePayersOnly: dto.feeRequirementPolicy === "PAID_ONLY",
        allowMultipleResponses: dto.allowMultipleResponses ?? false,
        allowResponseEdit: dto.allowResponseEdit ?? false,
        isKoreanOnly: dto.isKoreanOnly ?? false,
        isPublished: dto.isPublished ?? false,
        lifecycleStatus: "DRAFT",
        previousVersionId: lineage?.previousVersionId ?? null,
        versionNumber: lineage?.versionNumber ?? 1,
        showOnCalendar: dto.showOnCalendar ?? false,
        resultVisibility: dto.resultVisibility ?? "PRIVATE",
        connectedPostId: dto.connectedArticleId ?? null,
        responseCount: 0,
      });
    },
  };
  const sectionsRepo = {
    findBySurveyId: async (_id, repositoryTx) => {
      seenTransactions.push(repositoryTx);
      return [originalSection];
    },
    insert: async (_surveyId, _dto, repositoryTx) => {
      seenTransactions.push(repositoryTx);
      return { ...originalSection, id: "section-copy", surveyId: "survey-copy" };
    },
  };
  const questionsRepo = {
    findBySectionId: async (_id, repositoryTx) => {
      seenTransactions.push(repositoryTx);
      return [originalQuestion];
    },
    insert: async (_sectionId, dto, repositoryTx) => {
      seenTransactions.push(repositoryTx);
      createQuestionInput = dto;
      return { ...originalQuestion, id: "question-copy", editDeadlineAt: null };
    },
  };
  const service = new SurveysService(
    repo,
    sectionsRepo,
    questionsRepo,
    { countSubmitted: async () => 0 },
    policy,
  );

  const duplicated = await service.duplicate(original.id, "manager-2");

  assert.equal(duplicated.isPublished, false);
  assert.equal(duplicated.lifecycleStatus, "DRAFT");
  assert.equal(duplicated.previousVersionId, original.id);
  assert.equal(duplicated.versionNumber, 2);
  assert.equal(duplicated.resultVisibility, "PRIVATE");
  assert.equal(duplicated.connectedPostId, null);
  assert.equal(duplicated.responseCount, 0);
  assert.equal(createSurveyInput.isPublished, false);
  assert.equal(createSurveyInput.resultVisibility, "PRIVATE");
  assert.equal("connectedArticleId" in createSurveyInput, false);
  assert.equal("showOnCalendar" in createSurveyInput, false);
  assert.deepEqual(createSurveyLineage, {
    previousVersionId: original.id,
    versionNumber: 2,
  });
  assert.equal("editDeadlineAt" in createQuestionInput, false);
  assert.ok(seenTransactions.every((repositoryTx) => repositoryTx === tx));
  assert.equal(events.filter((event) => event === "transaction:start").length, 1);
  assert.equal(events.filter((event) => event === "transaction:end").length, 1);
});
