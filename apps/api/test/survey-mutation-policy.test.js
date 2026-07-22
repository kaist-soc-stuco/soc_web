const assert = require("node:assert/strict");
const test = require("node:test");
const { ConflictException } = require("@nestjs/common");

const {
  SurveyMutationPolicy,
  changesSurveyMeaning,
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
    kind: "GENERAL",
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
    archivedAt: null,
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

async function expectConflict(promise, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConflictException);
    assert.equal(error.message, message);
    return true;
  });
}

test("detects only edits that can change the meaning of existing responses", () => {
  const current = survey();

  assert.equal(changesSurveyMeaning(current, { titleKo: "Changed title" }), true);
  assert.equal(
    changesSurveyMeaning(current, { feeRequirementPolicy: "PAID_ONLY" }),
    true,
  );
  assert.equal(
    changesSurveyMeaning(current, { allowMultipleResponses: true }),
    true,
  );
  assert.equal(
    changesSurveyMeaning(current, {
      kind: current.kind,
      titleKo: current.titleKo,
      titleEn: current.titleEn,
      descriptionKo: current.descriptionKo,
      descriptionEn: current.descriptionEn,
      feeRequirementPolicy: "NONE",
      allowMultipleResponses: current.allowMultipleResponses,
      allowResponseEdit: current.allowResponseEdit,
      isKoreanOnly: current.isKoreanOnly,
      resultVisibility: "PRIVATE",
      isPublished: false,
      showOnCalendar: false,
      closeAt: NOW,
    }),
    false,
  );
});

test("locks the survey row, checks submitted responses, and mutates in one transaction", async () => {
  const blocked = createPolicyHarness({ responseCount: 1 });
  let blockedMutationCalled = false;

  await expectConflict(
    blocked.policy.withStructureMutation("survey-1", async () => {
      blockedMutationCalled = true;
    }),
    "survey_structure_locked_after_response",
  );
  assert.equal(blockedMutationCalled, false);
  assert.deepEqual(blocked.events, [
    "transaction:start",
    "lock:update",
    "count-submitted",
    "transaction:end",
  ]);

  const allowed = createPolicyHarness({ responseCount: 0 });
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
    "count-submitted",
    "mutation",
    "transaction:end",
  ]);
});

test("hard deletion uses the same lock and transaction as the response check", async () => {
  const blocked = createPolicyHarness({ responseCount: 1 });
  let deleted = false;
  await expectConflict(
    blocked.policy.withHardDelete("survey-1", async () => {
      deleted = true;
    }),
    "survey_delete_blocked_after_response",
  );
  assert.equal(deleted, false);

  const allowed = createPolicyHarness({ responseCount: 0 });
  await allowed.policy.withHardDelete("survey-1", async (tx) => {
    assert.equal(tx, allowed.tx);
    deleted = true;
  });
  assert.equal(deleted, true);
  assert.deepEqual(allowed.events, [
    "transaction:start",
    "lock:update",
    "count-submitted",
    "count-derived",
    "transaction:end",
  ]);
});

test("published and archived surveys must be retained through the archive lifecycle", async () => {
  for (const lifecycleStatus of ["PUBLISHED", "ARCHIVED"]) {
    const retained = createPolicyHarness({ lifecycleStatus });
    let deleted = false;

    await expectConflict(
      retained.policy.withHardDelete("survey-1", async () => {
        deleted = true;
      }),
      "survey_delete_requires_draft",
    );
    assert.equal(deleted, false);
    assert.deepEqual(retained.events, [
      "transaction:start",
      "lock:update",
      "transaction:end",
    ]);
  }
});

test("hard deletion preserves version lineage with an explicit conflict", async () => {
  const linked = createPolicyHarness({ derivedVersionCount: 1 });
  let deleted = false;

  await expectConflict(
    linked.policy.withHardDelete("survey-1", async () => {
      deleted = true;
    }),
    "survey_delete_blocked_by_versions",
  );
  assert.equal(deleted, false);
});

test("archived surveys are terminal and reject structure changes before repository mutation", async () => {
  const archived = createPolicyHarness({
    lifecycleStatus: "ARCHIVED",
    responseCount: 0,
  });
  let mutationCalled = false;

  await expectConflict(
    archived.policy.withStructureMutation("survey-1", async () => {
      mutationCalled = true;
    }),
    "survey_archived_immutable",
  );

  assert.equal(mutationCalled, false);
  assert.deepEqual(archived.events, [
    "transaction:start",
    "lock:update",
    "transaction:end",
  ]);
});

test("meaning changes are blocked in the caller transaction while operational changes remain allowed", async () => {
  const blocked = createPolicyHarness({ responseCount: 1 });
  await expectConflict(
    blocked.policy.assertMeaningMutable(
      blocked.tx,
      "survey-1",
      survey(),
      { titleKo: "Changed title" },
    ),
    "survey_meaning_locked_after_response",
  );

  const allowed = createPolicyHarness({ responseCount: 1 });
  const current = survey();
  await allowed.policy.assertMeaningMutable(
    allowed.tx,
    "survey-1",
    current,
    {
      titleKo: current.titleKo,
      descriptionKo: current.descriptionKo,
      feeRequirementPolicy: "NONE",
      resultVisibility: "PRIVATE",
      isPublished: false,
      showOnCalendar: false,
      maxResponseCount: 100,
      closeAt: NOW,
    },
  );
  assert.deepEqual(allowed.events, []);
});

test("question and section services pass the locked transaction to every repository call", async () => {
  const { policy, tx } = createPolicyHarness({ responseCount: 0 });
  const seenTransactions = [];
  const questionsService = new SurveyQuestionsService(
    {
      insert: async (_sectionId, _dto, repositoryTx) => {
        seenTransactions.push(repositoryTx);
        return { id: "question-1" };
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

test("submitted responses freeze question definitions used by stored answers", async () => {
  const { policy } = createPolicyHarness({ responseCount: 1 });
  const repositoryCalls = [];
  const questionsService = new SurveyQuestionsService(
    {
      update: async () => repositoryCalls.push("update"),
      findById: async () => repositoryCalls.push("find"),
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

  await expectConflict(
    questionsService.update(
      "survey-1",
      "section-1",
      "question-1",
      { titleKo: "Changed question meaning" },
    ),
    "survey_structure_locked_after_response",
  );
  await expectConflict(
    questionsService.delete("survey-1", "section-1", "question-1"),
    "survey_structure_locked_after_response",
  );
  assert.deepEqual(repositoryCalls, []);
});

test("responded surveys are archived but cannot be hard-deleted", async () => {
  const current = survey({ derivedVersionCount: 2 });
  const { policy, tx } = createPolicyHarness({
    lifecycleStatus: "PUBLISHED",
    responseCount: 1,
  });
  let archiveCalled = false;
  let hardDeleteCalled = false;
  const repo = {
    findById: async (_id, repositoryTx) => {
      assert.equal(repositoryTx, tx);
      return current;
    },
    archive: async (_id, repositoryTx) => {
      assert.equal(repositoryTx, tx);
      archiveCalled = true;
      return {
        ...current,
        archivedAt: NOW,
        derivedVersionCount: 0,
        isPublished: false,
        lifecycleStatus: "ARCHIVED",
        showOnCalendar: false,
      };
    },
    delete: async () => {
      hardDeleteCalled = true;
    },
  };
  const responsesRepo = { countSubmitted: async () => 1 };
  const service = new SurveysService(repo, {}, {}, responsesRepo, policy);

  const archived = await service.archive("survey-1");

  assert.equal(archiveCalled, true);
  assert.equal(archived.isPublished, false);
  assert.equal(archived.lifecycleStatus, "ARCHIVED");
  assert.equal(archived.showOnCalendar, false);
  assert.equal(archived.responseCount, 1);
  assert.equal(archived.derivedVersionCount, 2);
  assert.equal(hardDeleteCalled, false);

  await expectConflict(
    service.delete("survey-1"),
    "survey_delete_requires_draft",
  );
  assert.equal(hardDeleteCalled, false);
});

test("archived survey settings cannot be changed or republished", async () => {
  const current = survey({
    archivedAt: NOW,
    isPublished: false,
    lifecycleStatus: "ARCHIVED",
    showOnCalendar: false,
  });
  const { policy, tx } = createPolicyHarness({ lifecycleStatus: "ARCHIVED" });
  let updateCalled = false;
  const service = new SurveysService(
    {
      findById: async (_id, repositoryTx) => {
        assert.equal(repositoryTx, tx);
        return current;
      },
      update: async () => {
        updateCalled = true;
      },
    },
    {},
    {},
    {},
    policy,
  );

  await expectConflict(
    service.update(current.id, { isPublished: true, titleKo: "Republished" }),
    "survey_archived_immutable",
  );
  assert.equal(updateCalled, false);
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

test("duplicates draft or archived surveys as a private, unlinked version in one transaction", async () => {
  const original = survey({
    isPublished: false,
    lifecycleStatus: "ARCHIVED",
    archivedAt: NOW,
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
        archivedAt: null,
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
