const assert = require("node:assert/strict");
const test = require("node:test");
const { GoogleSheetsClient } = require("../dist/apps/api/src/infrastructure/google/google-sheets.client.js");
const { GoogleFeeSheetsService } = require("../dist/apps/api/src/features/users/google-fee-sheets.service.js");
const { GoogleContactSheetsService } = require("../dist/apps/api/src/features/contacts/google-contact-sheets.service.js");
const { GoogleSurveySheetsService } = require("../dist/apps/api/src/features/surveys/google-survey-sheets.service.js");

test("every legacy Sheets entry point is retired before reading data or making a network request", async () => {
  const before = global.fetch;
  global.fetch = () => assert.fail("Google Sheets must not make network requests");
  try {
    for (const [service, methods] of [
      [new GoogleSheetsClient(), ["getSpreadsheetReference", "getOrCreateSpreadsheet", "ensureSpreadsheetInTargetFolder", "syncSheet"]],
      [new GoogleFeeSheetsService(), ["getReference", "connect", "sync"]],
      [new GoogleContactSheetsService(), ["getReference", "sync"]],
      [new GoogleSurveySheetsService(), ["connect", "refresh"]],
    ]) {
      for (const method of methods) await assert.rejects(service[method](), error => error.getStatus() === 410 && error.message === "google_sheets_retired");
    }
  } finally { global.fetch = before; }
});
