const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("personal-data exports require and record a download reason", () => {
  const files = [
    "src/features/admin-audit/audit-log-page.tsx",
    "src/features/admin-surveys/survey-responses-panel.tsx",
    "src/pages/admin/vote-editor-page.tsx",
  ].map((file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8"));

  for (const source of files) assert.match(source, /promptDownloadReason\(\)/);
  assert.match(files[1], /recordPersonalDataDownload/);
  assert.match(files[2], /recordPersonalDataDownload/);
});
