const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildFeeTrend } = require("../dist/test-src/features/admin-finance/fee-trend.js");

test("receipt trend fills empty days and starts cumulative amounts at the selected range", () => {
  const result = buildFeeTrend([
    {period:"2026-09-01",paidAmount:90000,paymentCount:2},
    {period:"2026-09-19",paidAmount:45000,paymentCount:1},
  ], "2026-09-18", "2026-09-21");
  assert.deepEqual(result.points.map(p=>p.amount), [0,45000,0,0]);
  assert.deepEqual(result.points.map(p=>p.cumulative), [0,45000,45000,45000]);
});
test("weekly and monthly buckets preserve totals across years and partial periods", () => {
  const rows = [{period:"2025-12-31",paidAmount:100,paymentCount:1},{period:"2026-01-01",paidAmount:200,paymentCount:2}];
  for (const [from,unit] of [["2025-12-01","주"],["2025-06-15","월"]]) {
    const result=buildFeeTrend(rows,from,"2026-01-31");
    assert.equal(result.unit,unit);
    assert.equal(result.points.at(-1).cumulative,300);
    assert.equal(result.points.reduce((sum,p)=>sum+p.count,0),3);
    assert.equal(result.points[0].start,from);
    assert.equal(result.points.at(-1).end,"2026-01-31");
  }
});
test("all-time starts at first receipt; empty and reversed periods are safe", () => {
  assert.equal(buildFeeTrend([{period:"2026-09-19",paidAmount:1,paymentCount:1}],"","2026-09-21").points.length,3);
  assert.equal(buildFeeTrend([],"","2026-09-21").points[0].amount,0);
  assert.deepEqual(buildFeeTrend([],"2026-09-22","2026-09-21").points,[]);
});
