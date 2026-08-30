const assert = require("node:assert/strict");
const test = require("node:test");

const {
  StudentFeeGoogleSheetsService,
} = process.env.TEST_TS_SOURCE === "1"
  ? require("../src/features/users/student-fee-google-sheets.service.ts")
  : require("../dist/apps/api/src/features/users/student-fee-google-sheets.service.js");

function createService() {
  const values = {
    GOOGLE_SHEETS_OAUTH_CLIENT_FILE: "/definitely/missing/google-oauth-client.json",
    GOOGLE_SHEETS_OAUTH_TOKEN_FILE: "/definitely/missing/google-oauth-token.json",
  };
  const service = new StudentFeeGoogleSheetsService(
    { get: (key) => values[key] },
    { find: async () => null },
    {},
    {},
  );
  return { service };
}

test("Google Sheets status reports missing OAuth secret files without throwing", async () => {
  const { service } = createService();
  assert.deepEqual(await service.getStatus(), {
    configured: false,
    created: false,
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
  });
});

test("Google Sheets rows map only supported editable fee fields", () => {
  const { service } = createService();
  const updates = service.parseUpdates([
    ["사용자ID", "학번", "이름", "상태", "적용학기수", "수납액", "비고"],
    [
      "48cf27f9-c914-4485-adb8-7cec115a6b15",
      "20261234",
      "김전산",
      "부분 납부",
      "4",
      "30,000",
      "차액 확인",
    ],
  ]);

  assert.deepEqual(updates, [{
    userId: "48cf27f9-c914-4485-adb8-7cec115a6b15",
    stdNo: "20261234",
    status: "PARTIAL",
    coverageSemesters: 4,
    paidAmount: 30000,
    note: "차액 확인",
  }]);
  assert.equal("nameKo" in updates[0], false);
});

test("Google Sheets import rejects all rows when an editable value is invalid", () => {
  const { service } = createService();
  assert.throws(
    () => service.parseUpdates([
      ["사용자ID", "상태", "적용학기수", "수납액", "비고"],
      ["48cf27f9-c914-4485-adb8-7cec115a6b15", "입금됨", "9", "-100", ""],
    ]),
    /google_sheets_validation_failed/,
  );
});
