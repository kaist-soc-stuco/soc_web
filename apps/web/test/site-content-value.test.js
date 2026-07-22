const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveLocalizedSiteContentValue,
} = require("../dist/test-src/lib/site-content-value.js");

const fallback = {
  valueKo: "기본 한국어",
  valueEn: "Default English",
};

test("site content uses the explicit fallback when no CMS override exists", () => {
  assert.equal(
    resolveLocalizedSiteContentValue(
      undefined,
      "home.hero.description",
      "ko",
      fallback,
    ),
    fallback.valueKo,
  );
  assert.equal(
    resolveLocalizedSiteContentValue(
      [],
      "home.hero.description",
      "en",
      fallback,
    ),
    fallback.valueEn,
  );
});

test("site content selects the requested CMS language without cross-language fallback", () => {
  const records = [
    {
      key: "home.hero.description",
      updatedAt: "2026-07-15T00:00:00.000Z",
      valueKo: "저장된 한국어",
      valueEn: "Saved English",
    },
  ];

  assert.equal(
    resolveLocalizedSiteContentValue(
      records,
      "home.hero.description",
      "ko",
      fallback,
    ),
    "저장된 한국어",
  );
  assert.equal(
    resolveLocalizedSiteContentValue(
      records,
      "home.hero.description",
      "en",
      fallback,
    ),
    "Saved English",
  );
});
