const assert = require("node:assert/strict");
const test = require("node:test");
const { Permissions } = require("@soc/contracts");
const {
  canPreviewSearch,
} = require("../dist/test-src/features/search/search-preview-query.js");
const {
  isMobileAdminRoute,
  getMobileAdminHome,
} = require("../dist/test-src/lib/mobile-admin.js");
const {
  buildMobileAgendaGroups,
} = require("../dist/test-src/features/events-surveys/events-surveys-calendar-utils.js");

test("search waits for two complete characters and IME composition to finish", () => {
  for (const value of ["", " ", "가", "ㅁ", "가ㅁ", "ㅎㅏ", "a "])
    assert.equal(canPreviewSearch(value), false, value);
  for (const value of ["한글", " AI ", "26", "학교 생활"])
    assert.equal(canPreviewSearch(value), true, value);
  assert.equal(canPreviewSearch("한글", true), false);
});

test("mobile admin only permits the five selected route families", () => {
  for (const path of ["moderation", "calendar", "contacts", "faq", "boards"]) {
    assert.equal(isMobileAdminRoute(`/admin/${path}`), true);
    assert.equal(isMobileAdminRoute(`/admin/${path}/detail`), true);
  }
  for (const path of [
    "",
    "users",
    "finance",
    "surveys",
    "votes",
    "emails",
    "content",
    "permissions",
    "audit-logs",
    "roadmap",
    "boards-extra",
  ])
    assert.equal(isMobileAdminRoute(`/admin/${path}`), false, path);
  assert.equal(getMobileAdminHome(0), null);
  assert.equal(getMobileAdminHome(Permissions.MANAGE_SURVEY), null);
  assert.equal(
    getMobileAdminHome(Permissions.MANAGE_CALENDAR),
    "/admin/calendar",
  );
  assert.equal(
    getMobileAdminHome(
      Permissions.MODERATE_CONTENT | Permissions.MANAGE_CALENDAR,
    ),
    "/admin/moderation",
  );
});

const date = (day) => new Date(2026, 9, day, 12);
const event = (id, start, end = start, extra = {}) => ({
  id,
  date: date(start),
  startAt: date(start),
  endAt: date(end),
  ...extra,
});

test("an empty selected day still shows subsequent agenda groups chronologically", () => {
  const groups = buildMobileAgendaGroups(
    [event("later", 29), event("first", 27), event("old", 20)],
    date(26),
  );
  assert.deepEqual(
    groups.map((group) => group.events.map((item) => item.id)),
    [["first"], ["later"]],
  );
  assert.deepEqual(
    groups.map((group) => group.date.getDate()),
    [27, 29],
  );
});

test("ongoing multi-day events appear once; timeless, expired and invalid events stay out", () => {
  const ongoing = event("ongoing", 24, 29);
  const groups = buildMobileAgendaGroups(
    [
      ongoing,
      ongoing,
      event("always", 26, 27, { isAlways: true }),
      event("ended", 23),
      event("bad", 26, 26, { startAt: new Date(NaN) }),
    ],
    date(26),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].date.getDate(), 26);
  assert.deepEqual(
    groups[0].events.map((item) => item.id),
    ["ongoing"],
  );
});
