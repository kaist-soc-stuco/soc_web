const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getReachableSurveyQuestions,
  assertQuestionBranchConfiguration,
} = require("../dist/apps/api/src/features/surveys/survey-branching.js");

const question = (overrides = {}) => ({
  id: "question-1",
  sectionId: "section-1",
  titleKo: "질문",
  titleEn: null,
  descriptionKo: null,
  descriptionEn: null,
  questionType: "short_text",
  options: null,
  config: null,
  answerRegex: null,
  isRequired: false,
  sortOrder: 0,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  ...overrides,
});

test("survey branching follows a selected option into the target section", () => {
  const first = question({
    id: "q-1",
    questionType: "single_choice",
    options: [
      { value: "yes", labelKo: "예" },
      { value: "no", labelKo: "아니오" },
    ],
    config: { goToSectionByValue: { no: "section-3" } },
  });
  const second = question({ id: "q-2", sectionId: "section-2" });
  const third = question({ id: "q-3", sectionId: "section-3" });
  const sections = [
    { id: "section-1", sortOrder: 0, questions: [first] },
    { id: "section-2", sortOrder: 1, questions: [second] },
    { id: "section-3", sortOrder: 2, questions: [third] },
  ];

  assert.deepEqual(
    getReachableSurveyQuestions(sections, [
      { questionId: "q-1", content: { value: "no" } },
      { questionId: "q-3", content: { text: "reachable" } },
    ]).map((item) => item.id),
    ["q-1", "q-3"],
  );
});

test("survey branching can terminate the form at the selected answer", () => {
  const first = question({
    id: "q-1",
    questionType: "dropdown",
    options: [{ value: "done", labelKo: "완료" }],
    config: { goToSectionByValue: { done: "SUBMIT" } },
  });

  assert.deepEqual(
    getReachableSurveyQuestions(
      [
        { id: "section-1", sortOrder: 0, questions: [first] },
        { id: "section-2", sortOrder: 1, questions: [question({ id: "q-2", sectionId: "section-2" })] },
      ],
      [{ questionId: "q-1", content: { value: "done" } }],
    ).map((item) => item.id),
    ["q-1"],
  );
});

test("survey branching rejects option and section references that do not exist", () => {
  const invalid = question({
    questionType: "single_choice",
    options: [{ value: "yes", labelKo: "예" }],
    config: { goToSectionByValue: { missing: "section-2" } },
  });

  assert.throws(
    () => assertQuestionBranchConfiguration(invalid, new Set(["section-1", "section-2"]), "section-1"),
    /survey_branch_option_not_found/,
  );
});

