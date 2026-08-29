const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ROADMAP_COURSES,
  ROADMAP_LANES,
  ROADMAP_RELATIONS,
  ROADMAP_TRACKS,
} = require("../dist/test-src/features/roadmap/roadmap-data.js");
const { ROADMAP_OFFERINGS } = require("../dist/test-src/features/roadmap/roadmap-offerings.js");

test("keeps the roadmap course graph complete and internally consistent", () => {
  assert.equal(ROADMAP_COURSES.length, 65);
  assert.equal(ROADMAP_TRACKS.length, 9);
  assert.equal(ROADMAP_RELATIONS.length, 31);

  const courseCodes = new Set(ROADMAP_COURSES.map((course) => course.code));
  const trackIds = new Set(ROADMAP_TRACKS.map((track) => track.id));
  const displayedCodes = new Set(ROADMAP_LANES.flatMap((lane) => lane.courses));

  assert.equal(courseCodes.size, ROADMAP_COURSES.length, "course codes must be unique");
  assert.deepEqual(displayedCodes, courseCodes, "every course must appear in at least one lane");

  for (const course of ROADMAP_COURSES) {
    for (const trackId of course.tracks) {
      assert.ok(trackIds.has(trackId), `${course.code} uses an unknown track: ${trackId}`);
    }
  }

  for (const lane of ROADMAP_LANES) {
    if (lane.trackId) {
      assert.ok(trackIds.has(lane.trackId), `${lane.id} uses an unknown track`);
    }
    for (const courseCode of lane.courses) {
      assert.ok(courseCodes.has(courseCode), `${lane.id} uses an unknown course: ${courseCode}`);
    }
  }

  for (const relation of ROADMAP_RELATIONS) {
    assert.ok(courseCodes.has(relation.source), `unknown relation source: ${relation.source}`);
    assert.ok(courseCodes.has(relation.target), `unknown relation target: ${relation.target}`);
    assert.notEqual(relation.source, relation.target, "a course cannot point to itself");
  }
});

test("keeps 2026 term offerings limited to eligible undergraduate courses", () => {
  assert.equal(ROADMAP_OFFERINGS.filter((offering) => offering.term === "2026-spring").length, 49);
  assert.equal(ROADMAP_OFFERINGS.filter((offering) => offering.term === "2026-fall").length, 44);
  assert.ok(ROADMAP_OFFERINGS.some((offering) => offering.courseCode === "CS492"));
  assert.ok(ROADMAP_OFFERINGS.every((offering) => !/졸업연구|개별연구|논문연구/.test(offering.nameKo)));
});
