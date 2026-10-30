const assert = require("node:assert/strict");
const test = require("node:test");
const { createApiClient } = require("@soc/api-client");

test("all spreadsheet exports safely carry a Korean download reason in HTTP headers", async () => {
  const reason = "업무 인수인계 100%";
  const paths = [];
  const client = createApiClient({ baseUrl: "/api", fetcher: async (url, init) => {
    const headers = new Headers(init.headers);
    assert.equal(decodeURIComponent(headers.get("x-download-reason")), reason);
    paths.push(String(url));
    return new Response("workbook");
  }});
  await client.exportStudentFeeRoster(reason);
  await client.downloadContactsXlsx(reason);
  await client.downloadAuditLogsXlsx(reason);
  await client.downloadStudentFeeXlsx(reason);
  assert.equal(new Set(paths).size, 4);
});
