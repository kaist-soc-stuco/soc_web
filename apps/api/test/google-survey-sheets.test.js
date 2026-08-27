const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GoogleSurveySheetsService,
} = require("../dist/apps/api/src/features/surveys/google-survey-sheets.service.js");

const FOLDER_ID = "folder-1";

function createService(initialSurvey, config = {}) {
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
  const service = new GoogleSurveySheetsService(
    { get: (key) => config[key] },
    repository,
    { findBySurveyId: async () => [] },
    { findBySectionId: async () => [] },
    {
      findBySurveyId: async () => [],
      findAnswersBySurveyId: async () => [],
    },
  );
  service.request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.includes(`/drive/v3/files/${FOLDER_ID}?`)) {
      return {
        mimeType: "application/vnd.google-apps.folder",
        capabilities: { canAddChildren: true },
      };
    }
    if (method === "GET" && url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      return { files: [{ id: FOLDER_ID }] };
    }
    if (method === "POST" && url === "https://sheets.googleapis.com/v4/spreadsheets") {
      return { spreadsheetId: "sheet-1", spreadsheetUrl: "https://sheets.test/sheet-1" };
    }
    if (method === "GET" && url.includes("/drive/v3/files/sheet-1?")) {
      return { parents: ["root"] };
    }
    return {};
  };
  return { service, calls, getSurvey: () => survey };
}

test("creates a survey sheet in the OAuth app results folder", async () => {
  const { service, calls, getSurvey } = createService({
    id: "survey-1",
    titleKo: "진로 설문",
    spreadsheetId: null,
  });

  await service.connect("survey-1");

  const folderLookup = calls.find(
    (call) => call.method === "GET" && call.url.startsWith("https://www.googleapis.com/drive/v3/files?"),
  );
  assert.match(decodeURIComponent(folderLookup.url), /socPurpose/);
  const createCall = calls.find(
    (call) => call.method === "POST" && call.url === "https://sheets.googleapis.com/v4/spreadsheets",
  );
  assert.equal(createCall.body.properties.title, "진로 설문 응답 · survey-1");
  const moveCall = calls.find(
    (call) => call.method === "PATCH" && call.url.includes("/drive/v3/files/sheet-1?"),
  );
  assert.match(moveCall.url, /addParents=folder-1/);
  assert.equal(getSurvey().spreadsheetId, "sheet-1");
  assert.equal(getSurvey().spreadsheetSyncStatus, "CONNECTED");
});

test("creates the results folder once when the OAuth app has none", async () => {
  const { service, calls } = createService({
    id: "survey-1",
    titleKo: "진로 설문",
    spreadsheetId: null,
  });
  const originalRequest = service.request;
  service.request = async (method, url, body) => {
    if (method === "GET" && url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      calls.push({ method, url, body });
      return { files: [] };
    }
    if (method === "POST" && url === "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink") {
      calls.push({ method, url, body });
      return { id: FOLDER_ID };
    }
    return originalRequest(method, url, body);
  };

  await service.connect("survey-1");

  const folderCreate = calls.find(
    (call) => call.method === "POST" && call.url === "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",
  );
  assert.deepEqual(folderCreate.body, {
    name: "KAIST SOC 설문 결과",
    mimeType: "application/vnd.google-apps.folder",
    appProperties: { socPurpose: "survey-results" },
  });
});

test("rejects an explicitly configured folder that is not writable", async () => {
  const { service, calls } = createService(
    {
      id: "survey-1",
      titleKo: "진로 설문",
      spreadsheetId: null,
    },
    { GOOGLE_SURVEY_RESULTS_FOLDER_ID: FOLDER_ID },
  );
  service.request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.includes(`/drive/v3/files/${FOLDER_ID}?`)) {
      return {
        mimeType: "application/vnd.google-apps.folder",
        capabilities: { canAddChildren: false },
      };
    }
    return {};
  };

  await assert.rejects(
    service.connect("survey-1"),
    /google_survey_results_folder_not_writable/,
  );
  assert.equal(
    calls.some((call) => call.url === "https://sheets.googleapis.com/v4/spreadsheets"),
    false,
  );
});

test("reuses an existing spreadsheet instead of creating a duplicate", async () => {
  const { service, calls } = createService({
    id: "survey-1",
    titleKo: "진로 설문",
    spreadsheetId: "sheet-1",
  });

  await service.connect("survey-1");

  assert.equal(
    calls.some((call) => call.url === "https://sheets.googleapis.com/v4/spreadsheets"),
    false,
  );
  assert.equal(
    calls.some((call) => call.url.startsWith("https://www.googleapis.com/drive/v3/files?")),
    false,
  );
});
