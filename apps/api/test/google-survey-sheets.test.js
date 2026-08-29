const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GoogleSurveySheetsService,
} = require("../dist/apps/api/src/features/surveys/google-survey-sheets.service.js");

function createService(initialSurvey, sheets = {}) {
  let survey = { ...initialSurvey };
  const calls = [];
  const repository = {
    findById: async () => survey,
    updateSpreadsheetConnection: async (_id, update) => {
      survey = { ...survey, ...update };
    },
    updateSpreadsheetSyncState: async (_id, status) => {
      survey = { ...survey, spreadsheetSyncStatus: status };
    },
  };
  const sharedSheets = {
    getOrCreateSpreadsheet: async (options) => {
      calls.push({ kind: "getOrCreateSpreadsheet", options });
      return {
        spreadsheetId: "sheet-1",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-1/edit",
      };
    },
    ensureSpreadsheetInTargetFolder: async (spreadsheetId) => {
      calls.push({ kind: "ensureSpreadsheetInTargetFolder", spreadsheetId });
    },
    syncSheet: async (definition) => {
      calls.push({ kind: "syncSheet", definition });
    },
    ...sheets,
  };
  const service = new GoogleSurveySheetsService(
    sharedSheets,
    repository,
    { findBySurveyId: async () => [] },
    { findBySectionId: async () => [] },
    {
      findBySurveyId: async () => [],
      findAnswersBySurveyId: async () => [],
    },
  );
  return { service, calls, getSurvey: () => survey };
}

test("creates and syncs a survey response sheet through the shared Sheets client", async () => {
  const { service, calls, getSurvey } = createService({
    id: "survey-1",
    titleKo: "진로 설문",
    spreadsheetId: null,
  });

  await service.connect("survey-1");

  const createCall = calls.find((call) => call.kind === "getOrCreateSpreadsheet");
  assert.deepEqual(createCall.options, {
    title: "진로 설문 응답 · survey-1",
    sheetTitle: "응답",
    purpose: "survey-results",
    key: "survey-1",
  });
  const syncCall = calls.find((call) => call.kind === "syncSheet");
  assert.deepEqual(syncCall.definition.headers, [
    "응답 ID",
    "제출 시각",
    "이름",
    "이메일",
    "소속",
    "학번",
  ]);
  assert.deepEqual(syncCall.definition.dateTimeColumns, [1]);
  assert.deepEqual(syncCall.definition.columnWidths, [230, 155, 105, 240, 150, 100]);
  assert.equal(getSurvey().spreadsheetId, "sheet-1");
  assert.equal(getSurvey().spreadsheetSyncStatus, "CONNECTED");
});

test("moves an existing survey spreadsheet into the shared target folder before syncing", async () => {
  const { service, calls } = createService({
    id: "survey-1",
    titleKo: "진로 설문",
    spreadsheetId: "existing-sheet",
  });

  await service.connect("survey-1");

  assert.equal(
    calls.some((call) => call.kind === "getOrCreateSpreadsheet"),
    false,
  );
  assert.deepEqual(
    calls.find((call) => call.kind === "ensureSpreadsheetInTargetFolder"),
    { kind: "ensureSpreadsheetInTargetFolder", spreadsheetId: "existing-sheet" },
  );
  assert.equal(calls.some((call) => call.kind === "syncSheet"), true);
});

test("marks a failed response sync as an error", async () => {
  const { service, getSurvey } = createService(
    {
      id: "survey-1",
      titleKo: "진로 설문",
      spreadsheetId: "existing-sheet",
    },
    { syncSheet: async () => { throw new Error("sync failed"); } },
  );

  await assert.rejects(service.refresh("survey-1", true), /sync failed/);
  assert.equal(getSurvey().spreadsheetSyncStatus, "ERROR");
});

test("marks a failed sheet connection as an error", async () => {
  const { service, getSurvey } = createService(
    {
      id: "survey-1",
      titleKo: "진로 설문",
      spreadsheetId: null,
    },
    {
      getOrCreateSpreadsheet: async () => {
        throw new Error("oauth unavailable");
      },
    },
  );

  await assert.rejects(service.connect("survey-1"), /oauth unavailable/);
  assert.equal(getSurvey().spreadsheetSyncStatus, "ERROR");
});
