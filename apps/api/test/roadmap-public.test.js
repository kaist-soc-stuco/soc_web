const assert = require("node:assert/strict");
const test = require("node:test");

const {
  toPublicRoadmapCourse,
  toPublicRoadmapOffering,
  toPublicRoadmapOfferingTermSummary,
} = require("../dist/apps/api/src/features/roadmap/roadmap.repository.js");
const { RoadmapService } = require("../dist/apps/api/src/features/roadmap/roadmap.service.js");

test("public roadmap mappers remove identifiers, visibility, and import metadata", () => {
  const course = toPublicRoadmapCourse({
    courseId: "course-secret",
    courseCode: "CS10001",
    legacyCourseCode: "CS101",
    nameKo: "공개 과목",
    nameEn: "Public course",
    category: "major-required",
    credits: "3",
    semesters: "S/F",
    trackIds: [],
    ai: false,
    isVisible: true,
    source: "IMPORT",
    prerequisiteCourseCodes: [],
    postrequisiteCourseCodes: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const offering = toPublicRoadmapOffering({
    offeringId: "offering-secret",
    term: "2026-fall",
    courseCode: "CS10001",
    currentCode: "CS10001",
    nameKo: "공개 과목",
    section: "A",
    instructor: "교수",
    credits: "3",
    time: "월 1-2",
    room: "N101",
    capacity: 40,
    enrolled: 20,
    delivery: "대면",
    inEnglish: false,
    sourceFileName: "internal.xlsx",
    importedAt: "2026-01-01T00:00:00.000Z",
  });
  const term = toPublicRoadmapOfferingTermSummary({
    term: "2026-fall",
    offeringCount: 1,
    courseCount: 1,
    sourceFileName: "internal.xlsx",
    importedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal("courseId" in course, false);
  assert.equal("isVisible" in course, false);
  assert.equal("source" in course, false);
  assert.equal("createdAt" in course, false);
  assert.equal("offeringId" in offering, false);
  assert.equal("sourceFileName" in offering, false);
  assert.equal("importedAt" in offering, false);
  assert.equal("sourceFileName" in term, false);
  assert.equal("importedAt" in term, false);
});

test("public roadmap service never falls back to the admin aggregate", async () => {
  let publicCalls = 0;
  let adminCalls = 0;
  const repository = {
    findPublicData: async () => {
      publicCalls += 1;
      return { items: [], courses: [], relations: [], terms: [] };
    },
    findAdminData: async () => {
      adminCalls += 1;
      throw new Error("admin aggregate must not be used by public endpoint");
    },
  };
  const service = new RoadmapService(repository, {});

  assert.deepEqual(await service.listPublic(), {
    items: [],
    courses: [],
    relations: [],
    terms: [],
  });
  assert.equal(publicCalls, 1);
  assert.equal(adminCalls, 0);
});
