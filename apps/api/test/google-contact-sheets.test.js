const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GoogleContactSheetsService,
} = require("../dist/apps/api/src/features/contacts/google-contact-sheets.service.js");

function createService(config = {}) {
  const calls = [];
  const repository = {
    findManaged: async () => ({
      items: [
        {
          nameKo: "홍길동",
          nameEn: "Gildong Hong",
          studentNumber: "20261234",
          departmentKo: "회장단",
          departmentEn: "Presidium",
          roleKo: "회장",
          roleEn: "President",
          cohort: 26,
          email: "hong@example.com",
          phoneNumber: "010-0000-0000",
        },
      ],
    }),
  };
  const service = new GoogleContactSheetsService(
    { get: (key) => config[key] },
    repository,
  );
  service.request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === "GET" && url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      return { files: [] };
    }
    if (method === "POST" && url === "https://sheets.googleapis.com/v4/spreadsheets") {
      return { spreadsheetId: "contact-sheet-1" };
    }
    return {};
  };
  return { calls, service };
}

test("creates and syncs an executive contact sheet through the OAuth service", async () => {
  const { calls, service } = createService();

  const result = await service.sync();

  assert.deepEqual(result, {
    spreadsheetId: "contact-sheet-1",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/contact-sheet-1/edit",
    syncedCount: 1,
    syncedAt: result.syncedAt,
  });
  assert.equal(
    calls.some(
      (call) => call.method === "POST" && call.url === "https://sheets.googleapis.com/v4/spreadsheets",
    ),
    true,
  );
  const updateCall = calls.find((call) => call.method === "PUT");
  assert.ok(updateCall);
  assert.deepEqual(updateCall.body.values, [
    ["이름", "영문명", "학번", "부서", "영문부서", "직책", "영문직책", "활동 연도", "이메일", "전화번호"],
    ["홍길동", "Gildong Hong", "20261234", "회장단", "Presidium", "회장", "President", 2026, "hong@example.com", "010-0000-0000"],
  ]);
  const tagCall = calls.find((call) => call.method === "PATCH");
  assert.deepEqual(tagCall.body, { appProperties: { socPurpose: "executive-contacts" } });
});

test("reuses the configured contact spreadsheet without creating another file", async () => {
  const { calls, service } = createService({ GOOGLE_CONTACTS_SPREADSHEET_ID: "configured-sheet" });

  const result = await service.sync();

  assert.equal(result.spreadsheetId, "configured-sheet");
  assert.equal(
    calls.some((call) => call.method === "POST" && call.url === "https://sheets.googleapis.com/v4/spreadsheets"),
    false,
  );
});
