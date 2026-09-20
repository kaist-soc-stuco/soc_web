const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PgDialect } = require("drizzle-orm/pg-core");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");

test("receipt date filters are independent from benefit semester and current account status", async () => {
  const payments=[{userId:"u",amount:45000,paidAt:new Date("2026-09-18T15:30:00Z"),coverageSemesters:1,effectiveStartSemester:"2026-1"}];
  const conditions=[];
  const results=[payments,payments,[{userId:"u",primaryMajor:"CS"}],[]];
  let index=0;
  const db={select:()=>{
    const slot=index++;
    const chain={from:()=>chain,innerJoin:()=>chain,where:condition=>{conditions[slot]=new PgDialect().sqlToQuery(condition);return chain;},orderBy:()=>Promise.resolve(results[slot]),then:(resolve,reject)=>Promise.resolve(results[slot]).then(resolve,reject)};
    return chain;
  }};
  const repo=new UsersRepository(db);
  repo.getStudentFeePolicy=async()=>({amount:45000});
  const result=await repo.getStudentFeeStats({referenceSemester:"2026-2",dateFrom:"2026-09-19",dateTo:"2026-09-19",bucket:"day"});
  assert.doesNotMatch(conditions[0].sql,/effective_start_semester|is_active/);
  assert.match(conditions[0].sql,/paid_at/);
  assert.ok(conditions[0].params.includes("2026-09-18T15:00:00.000Z"));
  assert.ok(conditions[0].params.includes("2026-09-19T15:00:00.000Z"));
  assert.equal(result.totals.paidAmount,45000);
  assert.equal(result.totals.paidStudents,0);
  assert.equal(result.totals.partialStudents,0);
  assert.equal(result.totals.unpaidStudents,1);
  assert.equal(result.trend[0].period,"2026-09-19");
});
