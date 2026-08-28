const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getSocAffiliations,
  getSurveyEligibilityFailure,
} = require("../dist/apps/api/src/features/surveys/survey-eligibility.js");

test("recognizes School of Computing primary affiliation", () => {
  assert.deepEqual(getSocAffiliations({ primaryMajor: "전산학부" }), ["PRIMARY"]);
});

test("combines affiliation and academic conditions with AND semantics", () => {
  assert.equal(getSurveyEligibilityFailure({
    user: { primaryMajor: "전산학부", academicStatus: "재학" },
    eligibleSocAffiliations: ["PRIMARY"],
    academicEligibility: "ENROLLED_OR_LEAVE",
  }), null);

  assert.equal(getSurveyEligibilityFailure({
    user: { primaryMajor: "수리과학과", academicStatus: "재학" },
    eligibleSocAffiliations: ["PRIMARY"],
    academicEligibility: "ENROLLED_OR_LEAVE",
  }), "soc_affiliation_required");

  assert.equal(getSurveyEligibilityFailure({
    user: { primaryMajor: "전산학부", academicStatus: "졸업" },
    eligibleSocAffiliations: ["PRIMARY"],
    academicEligibility: "ENROLLED_OR_LEAVE",
  }), "academic_status_required");
});
