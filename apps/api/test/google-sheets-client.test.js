const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GoogleSheetsClient,
} = require("../dist/apps/api/src/infrastructure/google/google-sheets.client.js");

test("syncSheet writes date values and applies the shared read-only sheet format", async () => {
  const calls = [];
  const client = new GoogleSheetsClient({
    get: () => undefined,
  });
  client.request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === "GET" && url.includes("/spreadsheets/sheet-1?")) {
      return {
        sheets: [{
          properties: { sheetId: 42, title: "응답" },
          protectedRanges: [],
        }],
      };
    }
    return {};
  };

  await client.syncSheet({
    spreadsheetId: "sheet-1",
    sheetTitle: "응답",
    headers: ["응답 ID", "제출 시각"],
    rows: [["response-1", "2026-08-29T09:30:00+09:00"]],
    dateTimeColumns: [1],
    columnWidths: [230, 155],
    protectionDescription: "KAIST SOC · 설문 응답 · survey-1 (읽기 전용)",
  });

  const writeCall = calls.find((call) => call.method === "PUT");
  assert.deepEqual(writeCall.body.values[0], ["응답 ID", "제출 시각"]);
  assert.deepEqual(writeCall.body.values[1], ["response-1", 46263.02083333333]);

  const formatCall = calls.find((call) => call.url.includes(":batchUpdate"));
  const requests = formatCall.body.requests;
  assert.deepEqual(requests[0], {
    updateSheetProperties: {
      properties: { sheetId: 42, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });
  assert.equal(requests[1].repeatCell.cell.userEnteredFormat.wrapStrategy, "WRAP");
  assert.equal(requests[2].updateDimensionProperties.properties.pixelSize, 230);
  assert.equal(requests[3].updateDimensionProperties.properties.pixelSize, 155);
  assert.deepEqual(requests[4].repeatCell.cell.userEnteredFormat.numberFormat, {
    type: "DATE_TIME",
    pattern: "yyyy-mm-dd hh:mm",
  });
  assert.deepEqual(requests[5].addProtectedRange.protectedRange, {
    description: "KAIST SOC · 설문 응답 · survey-1 (읽기 전용)",
    warningOnly: false,
    range: { sheetId: 42 },
  });
});

test("getOrCreateSpreadsheet validates the destination folder before creating a file", async () => {
  const calls = [];
  const client = new GoogleSheetsClient({
    get: (key) => key === "GOOGLE_OPERATIONS_FOLDER_ID" ? "folder-1" : undefined,
  });
  client.request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.includes("/files/folder-1?")) {
      throw new Error("google_workspace_http_404");
    }
    return {};
  };

  await assert.rejects(
    client.getOrCreateSpreadsheet({
      title: "KAIST SOC 과비 납부",
      sheetTitle: "과비 납부",
      purpose: "student-fees",
    }),
    /google_workspace_http_404/,
  );
  assert.equal(
    calls.some((call) => call.method === "POST" && call.url === "https://sheets.googleapis.com/v4/spreadsheets"),
    false,
  );
});

test("chooses the next available title when creating a survey response spreadsheet", async () => {
  const calls = [];
  const client = new GoogleSheetsClient({
    get: (key) => key === "GOOGLE_OPERATIONS_FOLDER_ID" ? "folder-1" : undefined,
  });
  client.request = async (method, url, body) => {
    calls.push({ method, url, body });
    const queryText = new URL(url).searchParams.get("q") ?? "";
    if (url.includes("/files/folder-1?")) {
      return {
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
        capabilities: { canAddChildren: true },
      };
    }
    if (queryText.includes("appProperties has")) return { files: [] };
    if (queryText.includes("name contains")) {
      return {
        files: [
          { name: "전산인의 밤 참가 신청(응답)" },
          { name: "전산인의 밤 참가 신청 (응답) (1)" },
        ],
      };
    }
    if (method === "POST" && url === "https://sheets.googleapis.com/v4/spreadsheets") {
      return {
        spreadsheetId: "new-sheet",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new-sheet/edit",
      };
    }
    return {};
  };

  await client.getOrCreateSpreadsheet({
    title: "전산인의 밤 참가 신청(응답)",
    duplicateTitle: "전산인의 밤 참가 신청 (응답)",
    ensureUniqueTitle: true,
    sheetTitle: "응답",
    purpose: "survey-results",
    key: "survey-1",
  });

  const createCall = calls.find((call) => call.method === "POST" && call.url === "https://sheets.googleapis.com/v4/spreadsheets");
  assert.equal(createCall.body.properties.title, "전산인의 밤 참가 신청 (응답) (2)");
});

test("does not create a spreadsheet when the shared operations folder is not configured", async () => {
  const client = new GoogleSheetsClient({ get: () => undefined });

  await assert.rejects(
    client.getOrCreateSpreadsheet({
      title: "KAIST SOC 과비 납부",
      sheetTitle: "과비 납부",
      purpose: "student-fees",
    }),
    /google_operations_folder_not_configured/,
  );
});
