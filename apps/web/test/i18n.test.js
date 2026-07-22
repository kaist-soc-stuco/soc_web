const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getLocalizedText,
  resolveInitialLanguage,
} = require("../dist/test-src/lib/i18n.js");

test("saved language always wins over browser language", () => {
  assert.equal(
    resolveInitialLanguage({
      navigatorLanguages: ["ko-KR"],
      storedLanguage: "en",
    }),
    "en",
  );
});

test("new visitors use the first supported browser language", () => {
  assert.equal(
    resolveInitialLanguage({ navigatorLanguages: ["ko-KR", "en-US"] }),
    "ko",
  );
  assert.equal(
    resolveInitialLanguage({ navigatorLanguages: ["en-US", "ko-KR"] }),
    "en",
  );
  assert.equal(
    resolveInitialLanguage({ navigatorLanguages: ["fr-FR", "ko-KR"] }),
    "ko",
  );
});

test("localized text falls back to the available translation in either direction", () => {
  assert.equal(getLocalizedText("en", "한국어", null), "한국어");
  assert.equal(getLocalizedText("ko", null, "English"), "English");
  assert.equal(getLocalizedText("en", "한국어", "English"), "English");
});
