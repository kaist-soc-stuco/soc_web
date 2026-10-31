const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { CancelStudentFeePaymentSchema } = require("@soc/contracts");
const url = process.env.FEE_CANCEL_TEST_DATABASE_URL;
if (url && new URL(url).pathname !== "/soc_fee_workflow_test") throw new Error("isolated_fee_test_database_required");
const opts = { skip: !url };
let pool, db, repository, actor;
let nextNumber = 20980000;
before(async () => {
  if (!url) return;
  pool = new Pool({connectionString:url}); db = drizzle(pool,{schema});
  await pool.query("TRUNCATE users, paid_student_records CASCADE");
  repository = new UsersRepository(db,null,null);
  actor = randomUUID();
  await db.insert(schema.users).values({userId:actor,kaistUid:actor.slice(0,20),nameKo:"합성 담당자",email:`${actor}@example.test`});
});
after(async()=>{if(pool) await pool.end();});
async function receipt(amount, joined=true) {
  const stdNo=String(nextNumber++); let userId;
  if(joined) {userId=randomUUID(); await db.insert(schema.users).values({userId,stdNo,kaistUid:userId.slice(0,20),nameKo:"합성 납부자",email:`${userId}@example.test`});}
  await repository.saveStudentFeeRoster([{stdNo,nameKo:"합성 납부자",admissionYear:2026,paidSemesters:0,paidAmount:0,note:null,expectedUpdatedAt:null}]);
  const result=await repository.processStudentFeePayments({idempotencyKey:randomUUID(),payments:[{...(userId?{userId}:{stdNo}),amount,paymentType:"SIX_SEMESTER_LUMP_SUM",paymentMethod:"BANK_TRANSFER",effectiveStartSemester:"2026-2",coverageSemesters:6,paidAt:"2026-10-31T00:00:00Z",note:"합성 입금"}]},actor);
  return {stdNo,userId,payment:result.payments[0]};
}
const input=(payment,revokeRecognition=false)=>({reason:"학생 선택 오류",expectedUpdatedAt:payment.updatedAt,revokeRecognition});
test("cancellation requires a reason and preserves recognition by default",()=>{
  assert.equal(CancelStudentFeePaymentSchema.safeParse({reason:"",expectedUpdatedAt:"2026-10-31T00:00:00Z"}).success,false);
  assert.equal(CancelStudentFeePaymentSchema.parse({reason:"오입력",expectedUpdatedAt:"2026-10-31T00:00:00Z"}).revokeRecognition,false);
});
test("cancelled receipts remain in history and retries create only one audit event",opts,async()=>{
  const {stdNo,payment}=await receipt(10000);
  const first=await repository.cancelStudentFeePayment(payment.paymentId,input(payment),actor);
  const retry=await repository.cancelStudentFeePayment(payment.paymentId,input(payment),actor);
  assert.deepEqual(first,retry); assert.equal(first.amount,0);
  const detail=await repository.getStudentFeeRosterDetail(stdNo);
  assert.equal(detail.record.totalPaidAmount,0); assert.equal(detail.record.status,"UNPAID"); assert.equal(detail.history.length,1);
  const audit=await pool.query("select payload from audit_log where target_id=$1 and action='student_fee_payment.cancel'",[payment.paymentId]);
  assert.equal(audit.rows.length,1); const payload=JSON.parse(audit.rows[0].payload);
  assert.equal(payload.before.amount,10000); assert.equal(payload.after.amount,0); assert.equal(payload.reason,"학생 선택 오류");
  const stats=await repository.getStudentFeeStats({dateFrom:"2026-10-31",dateTo:"2026-10-31"});
  assert.equal(stats.totals.paymentCount,0); assert.equal(stats.totals.paidAmount,0);
});
test("cancelling a receipt does not automatically revoke lifetime recognition",opts,async()=>{
  const {stdNo,payment}=await receipt(45000);
  await repository.cancelStudentFeePayment(payment.paymentId,input(payment),actor);
  const {record}=await repository.getStudentFeeRosterDetail(stdNo);
  assert.equal(record.totalPaidAmount,0); assert.equal(record.status,"PAID");
});
test("explicitly cancelling mistaken completion restores unpaid status for joined and unregistered students",opts,async()=>{
  for(const joined of [true,false]) {
    const {stdNo,payment}=await receipt(45000,joined);
    await repository.cancelStudentFeePayment(payment.paymentId,input(payment,true),actor);
    const {record}=await repository.getStudentFeeRosterDetail(stdNo);
    assert.equal(record.totalPaidAmount,0); assert.equal(record.status,"UNPAID"); assert.equal(record.remainingAmount,45000);
  }
});
test("stale cancellation is rejected without changing the receipt",opts,async()=>{
  const {payment}=await receipt(5000);
  await assert.rejects(repository.cancelStudentFeePayment(payment.paymentId,{...input(payment),expectedUpdatedAt:"2000-01-01T00:00:00Z"},actor),/fee_payment_changed/);
  const result=await pool.query("select amount from student_fee_payment where payment_id=$1",[payment.paymentId]);
  assert.equal(result.rows[0].amount,5000);
});
