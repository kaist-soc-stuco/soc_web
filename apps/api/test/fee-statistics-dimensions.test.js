const { test } = require("node:test");
const assert = require("node:assert/strict");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");

test("receipt dates remain independent of benefit semesters, account status and registration", async () => {
  const receipts = [
    {userId:"u",stdNo:null,amount:45000,paidAt:new Date("2026-09-18T15:30:00Z"),coverageSemesters:1,effectiveStartSemester:"2026-1"},
    {userId:null,stdNo:"20990001",amount:10000,paidAt:new Date("2026-09-19T14:59:59Z"),coverageSemesters:1,effectiveStartSemester:"2026-1"},
    {userId:"u",stdNo:null,amount:3000,paidAt:new Date("2026-09-19T15:00:00Z"),coverageSemesters:1,effectiveStartSemester:"2026-1"},
  ];
  const results = [receipts,[{userId:"u",primaryMajor:"CS"}]]; let index=0;
  const db={select:()=>{const result=results[index++];const query={from:()=>query,leftJoin:()=>query,where:()=>query,orderBy:()=>Promise.resolve(result),then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};return query;}};
  const repository=new UsersRepository(db);
  repository.listStudentFeeRoster=async()=>[{userId:"u",stdNo:"20990002",status:"UNPAID",totalPaidAmount:48000},{userId:null,stdNo:"20990001",status:"UNPAID",totalPaidAmount:10000}];
  repository.getStudentFeePolicy=async()=>({amount:45000});
  const result=await repository.getStudentFeeStats({referenceSemester:"2026-2",dateFrom:"2026-09-19",dateTo:"2026-09-19",bucket:"day"});
  assert.equal(result.totals.paidAmount,55000);
  assert.equal(result.totals.paymentCount,2);
  assert.equal(result.totals.paidStudents,0);
  assert.equal(result.totals.unpaidStudents,2);
  assert.equal(result.totals.collectedAmount,58000);
  assert.equal(result.trend[0].period,"2026-09-19");
  assert.equal(result.trend[0].paidStudents,2);
});
