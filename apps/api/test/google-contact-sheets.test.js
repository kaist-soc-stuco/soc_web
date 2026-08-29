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
  const sheets = {
    getOrCreateSpreadsheet: async (options) => {
      calls.push({ kind: "getOrCreateSpreadsheet", options });
      return {
        spreadsheetId: config.GOOGLE_CONTACTS_SPREADSHEET_ID || "contact-sheet-1",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/contact-sheet-1/edit",
      };
    },
    syncSheet: async (definition) => {
      calls.push({ kind: "syncSheet", definition });
    },
  };
  const service = new GoogleContactSheetsService(
    { get: (key) => config[key] },
    sheets,
    repository,
  );
  return { calls, service };
}

test("creates and formats an executive contact sheet through the shared Sheets client", async () => {
  const { calls, service } = createService();

  const result = await service.sync();

  assert.deepEqual(result, {
    spreadsheetId: "contact-sheet-1",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/contact-sheet-1/edit",
    syncedCount: 1,
    syncedAt: result.syncedAt,
  });
  const createCall = calls.find((call) => call.kind === "getOrCreateSpreadsheet");
  assert.deepEqual(createCall.options, {
    configuredSpreadsheetId: undefined,
    title: "KAIST SOC 집행위 연락망",
    sheetTitle: "연락망",
    purpose: "executive-contacts",
  });
  const syncCall = calls.find((call) => call.kind === "syncSheet");
  assert.deepEqual(syncCall.definition.headers, [
    "이름",
    "영문명",
    "학번",
    "부서",
    "영문부서",
    "직책",
    "영문직책",
    "활동 연도",
    "이메일",
    "전화번호",
  ]);
  assert.deepEqual(syncCall.definition.rows, [[
    "홍길동",
    "Gildong Hong",
    "20261234",
    "회장단",
    "Presidium",
    "회장",
    "President",
    2026,
    "hong@example.com",
    "010-0000-0000",
  ]]);
  assert.deepEqual(syncCall.definition.columnWidths, [120, 160, 100, 140, 160, 140, 160, 100, 230, 140]);
  assert.equal(syncCall.definition.protectionDescription, "KAIST SOC · 집행부원 연락망 (읽기 전용)");
});

test("passes the configured contact spreadsheet through without creating a duplicate", async () => {
  const { calls, service } = createService({ GOOGLE_CONTACTS_SPREADSHEET_ID: "configured-sheet" });

  const result = await service.sync();

  assert.equal(result.spreadsheetId, "configured-sheet");
  const createCall = calls.find((call) => call.kind === "getOrCreateSpreadsheet");
  assert.equal(createCall.options.configuredSpreadsheetId, "configured-sheet");
});
