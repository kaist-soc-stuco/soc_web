import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { BulkProcessStudentFeePaymentsRequest, StudentFeePaymentRecord, StudentFeePolicy, StudentFeeRosterDetailResponse, StudentFeeStatsResponse } from "@soc/contracts";
import { isoToDate, nowDate, msToDate } from "@soc/shared";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminFormField, AdminLoadingState, AdminPageHeader, AdminPageMain, AdminPageShell } from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { type DateRange } from "@/components/ui/date-range-picker";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api";
import { Permissions } from "@/lib/permissions";
import { randomId } from "@/lib/random-id";
import { feeRosterRow, type FeeRosterRow } from "@/lib/fee-roster";
import { FeeRosterPanel } from "./fee-roster-panel";
import { FeeStatisticsPanel } from "./fee-statistics-panel";
const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const today = () => nowDate().toLocaleDateString("en-CA", {timeZone:"Asia/Seoul"});
const stamp = (value: string | null | undefined) => value ? isoToDate(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "—";
const semesterLabel = (value: string) => value.replace(/^(\d{4})-([12])$/, "$1학년도 $2학기");
const currentSemester = () => { const now = nowDate(); return `${now.getFullYear()}-${now.getMonth() < 6 ? 1 : 2}`; };
const remainingFee = (row: FeeRosterRow) => row.status === "PAID" ? 0 : row.remainingAmount ?? 0;
export function FeeManagementPage() {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const { data: session } = useCurrentSession();
  const canEdit = Permissions.has(session?.permission ?? 0, Permissions.MANAGE_FINANCE);
  const canRead = Permissions.hasAny(session?.permission ?? 0, Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE);
  const canExport = Permissions.has(session?.permission ?? 0, Permissions.EXPORT_FINANCE);
  const { toast } = useToast();
  const [tab, setTab] = useState("payments");
  const [semester, setSemester] = useState(currentSemester);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<FeeRosterRow[]>([]);
  const [policy, setPolicy] = useState<StudentFeePolicy | null>(null);
  const [policyAmount, setPolicyAmount] = useState("");
  const [policyError, setPolicyError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<StudentFeeRosterDetailResponse | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const [targets, setTargets] = useState<FeeRosterRow[] | null>(null);
  const [date, setDate] = useState(today);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentType, setPaymentType] = useState<"SIX_SEMESTER_LUMP_SUM" | "PRIOR_PAYMENT_BALANCE">("SIX_SEMESTER_LUMP_SUM");
  const amount = targets?.length === 1 ? paymentType === "SIX_SEMESTER_LUMP_SUM" ? policy?.amount ?? 0 : remainingFee(targets[0]) : 0;
  const [error, setError] = useState<string | null>(null);
  const [cancelPayment, setCancelPayment] = useState<StudentFeePaymentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [revokeRecognition, setRevokeRecognition] = useState(false);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const [statsRange, setStatsRange] = useState<DateRange>(() => { const end = nowDate(); const start = msToDate(end.valueOf()); start.setDate(start.getDate() - 29); return { from: start.toLocaleDateString("en-CA", {timeZone:"Asia/Seoul"}), to: end.toLocaleDateString("en-CA", {timeZone:"Asia/Seoul"}) }; });
  const [stats, setStats] = useState<StudentFeeStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const semesters = useMemo(() => { const now = nowDate(); const end = now.getFullYear() * 2 + (now.getMonth() < 6 ? 0 : 1); return Array.from({length: Math.max(1, end - 4052 + 1)}, (_, i) => {const value = end - i; const semester = `${Math.floor(value / 2)}-${value % 2 + 1}`; return {value: semester, label: semesterLabel(semester)}; }); }, []);
  useEffect(() => { if (!canRead) return; let active = true; setPolicy(null); setPolicyError(false); void client.getStudentFeePolicy(semester).then(result => { if (active) { setPolicy(result); setPolicyAmount(String(result.amount)); } }).catch(() => { if (active) setPolicyError(true); }); return () => { active = false; }; }, [client, semester, canRead]);
  const loadStats = useCallback(async () => {
    if (!canRead) return;
    setStatsLoading(true); setStatsError(null);
    try { setStats(await client.getStudentFeeStats({referenceSemester: semester, dateFrom: statsRange.from, dateTo: statsRange.to, bucket: "day"})); }
    catch { setStatsError("통계를 불러오지 못했습니다."); }
    finally { setStatsLoading(false); }
  }, [client, canRead, semester, statsRange]);
  useEffect(() => { if (tab === "stats") void loadStats(); }, [tab, loadStats, revision]);
  const openDetail = useCallback(async (row: FeeRosterRow) => {
    const identifier = row.userId ?? row.stdNo;
    const request = ++detailRequest.current;
    setDetailId(identifier); setDetail(null); setDetailLoading(true);
    try { const result = await client.getStudentFeeRosterDetail(identifier, semester); if (request === detailRequest.current) setDetail(result); }
    catch { if (request === detailRequest.current) toast({type:"error",message:"납부 상세를 불러오지 못했습니다."}); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  }, [client, semester, toast]);
  const saved = useCallback(() => { void queryClient.invalidateQueries({queryKey:["auth", "session"]}); }, [queryClient]);
  const refresh = async () => {
    setRevision(value => value + 1); saved();
    if (detailId) setDetail(await client.getStudentFeeRosterDetail(detailId, semester));
  };
  const beginPayment = (rows: FeeRosterRow[]) => {
    if (!policy || !rows.length || dirty) return;
    if (rows.some(row => remainingFee(row) <= 0)) return;
    if (rows.length > 1000) {toast({type:"error",message:"한 번에 최대 1,000명까지 납부 처리할 수 있습니다."});return;}
    setTargets(rows); setError(null); setDate(today()); setPaymentNote("");
    const previous = rows.length === 1 ? rows[0].totalPaidAmount ?? 0 : 0;
    setPaymentType(previous > 0 ? "PRIOR_PAYMENT_BALANCE" : "SIX_SEMESTER_LUMP_SUM");
  };
  const submitPayment = async () => {
    if (!targets || busy) return;
    const paidAt = isoToDate(`${date}T00:00:00.000+09:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(paidAt.valueOf()) ||
      (targets.length === 1 && (!Number.isInteger(amount) || amount <= 0 || amount > remainingFee(targets[0])))) {
      setError("납부 일자와 금액을 확인해 주세요. 미납 차액을 초과할 수 없습니다."); return;
    }
    const recordingSemester = `${date.slice(0, 4)}-${Number(date.slice(5, 7)) <= 6 ? 1 : 2}`;
    const payments: BulkProcessStudentFeePaymentsRequest["payments"] = targets.map(row => ({ ...(row.userId ? { userId: row.userId } : { stdNo: row.stdNo }), amount: targets.length > 1 ? remainingFee(row) : amount,
      paymentType: targets.length > 1 ? (row.totalPaidAmount ?? 0) > 0 ? "PRIOR_PAYMENT_BALANCE" : "SIX_SEMESTER_LUMP_SUM" : paymentType,
      coverageSemesters: 6, effectiveStartSemester: recordingSemester, paidAt: paidAt.toISOString(), note: paymentNote.trim() || null }));
    const fingerprint = JSON.stringify(payments);
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = {fingerprint, key:randomId()};
    setBusy(true); setError(null);
    try { await client.processStudentFeePayments({idempotencyKey:idempotency.current.key, payments}); idempotency.current = null; setTargets(null); setSelected([]); await refresh(); toast({type:"success",message:`${payments.length}명의 납부 내역을 반영했습니다.`}); }
    catch { setError("납부 내역을 반영하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  const eligible = selected.filter(row => remainingFee(row) > 0);
  const cancelReceipt = async () => {
    if (!cancelPayment || busy) return;
    if (cancelReason.trim().length < 2) { setError("취소 사유를 2자 이상 입력해 주세요."); return; }
    setBusy(true); setError(null);
    try {
      await client.cancelStudentFeePayment(cancelPayment.paymentId, { reason: cancelReason.trim(), expectedUpdatedAt: cancelPayment.updatedAt, revokeRecognition });
      setCancelPayment(null); await refresh(); toast({type:"success",message:"입금 기록을 취소했습니다."});
    } catch { setError("취소하지 못했습니다. 최신 납부 내역을 다시 확인해 주세요."); }
    finally { setBusy(false); }
  };
  return <AuthGuard requireAnyPermission={[Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE]}><AdminPageShell className={`admin-fee-page ${tab === "payments" ? "admin-fee-page--payments" : ""}`}>
    <AdminPageMain className="admin-fee-management !max-w-none !gap-4 md:!px-6 xl:!px-6">
      <AdminPageHeader title="과비 관리" actions={tab === "settings" ? <AdminSelectDropdown className="w-48" ariaLabel="설정 적용 학기" value={semester} disabled={dirty || busy} onChange={value => {setSemester(value); setDetailId(null);}} options={semesters} /> : undefined} />
      <div className="flex flex-wrap items-center justify-between gap-3"><SegmentedControl variant="underline" role="tablist" className="w-fit" ariaLabel="과비 관리 보기" value={tab} onChange={value => {if (!dirty) setTab(value);}} options={[{value:"payments",label:"납부 관리"},{value:"stats",label:"통계"},...(canEdit ? [{value:"settings",label:"설정"}] : [])]} />

      </div>
      {policyError && <p role="alert" className="text-sm text-rose-700">표준 과비 설정을 불러오지 못했습니다.</p>}
      {tab === "payments" && <FeeRosterPanel canEdit={canEdit} canExport={canExport} semester={semester} revision={revision} onDirtyChange={setDirty} onSelectionChange={setSelected} onOpenDetail={openDetail} onSaved={saved} selectionAction={canEdit && selected.length > 0 ? <Button disabled={!eligible.length || dirty || busy || !policy} onClick={() => beginPayment(eligible)}>선택 납부 처리 ({eligible.length}명)</Button> : null} />}
      {tab === "stats" && <FeeStatisticsPanel stats={stats} loading={statsLoading} error={statsError} onRetry={() => void loadStats()} range={statsRange} displayedRange={statsRange} onRangeChange={setStatsRange} />}
      {tab === "settings" && <section className="flex items-end gap-3 rounded-xl border border-slate-200 p-5"><AdminFormField label="표준 과비 (원)"><UiInput type="number" min={1} value={policyAmount} onChange={event=>setPolicyAmount(event.target.value)} /></AdminFormField><Button loading={busy} disabled={!canEdit || !policy || busy} onClick={async()=>{if(!Number.isInteger(Number(policyAmount)) || Number(policyAmount)<=0) return; setBusy(true);try {setPolicy(await client.createStudentFeePolicy({effectiveSemester:semester,amount:Number(policyAmount),coverageSemesters:6}));setRevision(value=>value+1);toast({type:"success",message:"표준 금액을 저장했습니다."});}catch{toast({type:"error",message:"설정을 저장하지 못했습니다."});}finally{setBusy(false);}}}>저장</Button></section>}
    </AdminPageMain>
    <AdminDrawer open={Boolean(detailId)} onClose={()=>{detailRequest.current++;setDetailId(null);}} title={detail?.record.nameKo ? `${detail.record.nameKo} 납부 상세` : "납부 상세"} width="max-w-2xl">
      {detailLoading ? <AdminLoadingState /> : detail ? <div className="space-y-6">
        <div><h3 className="text-lg font-semibold">{detail.record.nameKo}</h3><p className="mt-1 text-sm text-slate-500">{detail.record.stdNo || "학번 없음"} · {detail.record.userId ? "가입" : "미가입"}{detail.record.email ? ` · ${detail.record.email}` : ""}</p></div>
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4 text-sm"><div><dt className="text-slate-500">납부 상태</dt><dd className="mt-2"><AdminStatusBadge tone={detail.record.status === "PAID" ? "positive" : detail.record.status === "PARTIAL" ? "warning" : "neutral"}>{detail.record.status === "PAID" ? "완납" : detail.record.status === "PARTIAL" ? "부분 납부" : "미납"}</AdminStatusBadge></dd></div><div><dt className="text-slate-500">누적 수납액</dt><dd className="mt-2 font-semibold tabular-nums">{money(detail.record.totalPaidAmount ?? 0)}</dd></div><div><dt className="text-slate-500">미납 차액</dt><dd className="mt-2">{money(detail.record.remainingAmount ?? 0)}</dd></div><div><dt className="text-slate-500">최근 납부</dt><dd className="mt-2">{stamp(detail.record.paidAt)}</dd></div></dl>
        <section><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">납부 이력</h3>{canEdit && <Button size="sm" disabled={dirty || !policy || remainingFee(feeRosterRow(detail.record)) <= 0} onClick={()=>beginPayment([feeRosterRow(detail.record)])}>납부 내역 추가</Button>}</div>
          {!detail.history.length && <p className="text-sm text-slate-500">등록된 납부 이력이 없습니다.</p>}
          <div className="divide-y divide-slate-100">{detail.history.map(payment=><div className="py-3 text-sm" key={payment.paymentId}><p className="font-medium">{money(payment.amount)} · {payment.amount === 0 ? "입금 취소됨" : `${payment.paymentType === "INITIAL_RECORD" ? "기초자료" : semesterLabel(payment.effectiveStartSemester) + " 납부 기록"}`}</p>{canEdit && payment.amount > 0 && <Button size="sm" variant="outline" className="mt-2" disabled={dirty || busy} onClick={()=>{setCancelPayment(payment);setCancelReason("");setRevokeRecognition(false);setError(null);}}>입금 취소</Button>}<p className="mt-1 text-xs text-slate-500">{payment.paymentType === "INITIAL_RECORD" ? "입금일 미상" : stamp(payment.paidAt)}{payment.paymentType !== "INITIAL_RECORD" && ` · ${payment.paymentType === "PRIOR_PAYMENT_BALANCE" ? "기납부 차액" : "6학기 일시납"}`}{payment.note ? ` · ${payment.note}` : ""}</p></div>)}</div></section>
      </div> : <p className="text-sm text-slate-500">상세 정보를 불러오지 못했습니다.</p>}
    </AdminDrawer>
    <Modal size="wide" open={Boolean(targets)} onClose={()=>{if(!busy)setTargets(null);}} title="납부 내역 추가" footer={<><span className="mr-auto text-sm font-medium">{targets?.length ?? 0}명 · 합계 {money(targets?.reduce((sum,row)=>sum+(targets.length===1 ? amount : remainingFee(row)),0) ?? 0)}</span><Button variant="outline" disabled={busy} onClick={()=>setTargets(null)}>취소</Button><Button loading={busy} disabled={busy} onClick={()=>void submitPayment()}>납부 처리</Button></>}>
      <p className="mb-4 text-sm">{targets?.length === 1 ? targets[0].nameKo : `${targets?.length ?? 0}명`} · {targets && targets.length > 1 ? "각 대상자의 미납 차액만 기록합니다." : `미납 차액 ${money(targets ? remainingFee(targets[0]) : 0)}`}</p>
      {targets && targets.length > 1 && <><div className="mb-3 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">일괄 납부 확인표</caption><thead><tr className="border-b border-slate-200"><th className="p-2">이름</th><th className="p-2">학번</th><th className="p-2 text-right">기존 수납액</th><th className="p-2 text-right">이번 납부액</th></tr></thead><tbody>{targets.map(row=><tr key={row.key} className="border-b border-slate-100"><td className="p-2">{row.nameKo}</td><td className="p-2">{row.stdNo}</td><td className="p-2 text-right tabular-nums">{money(row.totalPaidAmount ?? 0)}</td><td className="p-2 text-right tabular-nums">{money(remainingFee(row))}</td></tr>)}</tbody></table></div><p className="mb-4 text-xs text-slate-500">입금 내역과 이름·학번·금액을 대조해 주세요.</p></>}
      <div className="grid gap-4 sm:grid-cols-2">{targets?.length === 1 && <AdminFormField label="납부 금액 (원)"><UiInput type="number" min={1} max={remainingFee(targets[0])} value={amount} readOnly /></AdminFormField>}<AdminFormField label="납부 일자"><UiInput type="date" value={date} onChange={event=>setDate(event.target.value)} /></AdminFormField>
        {targets?.length === 1 && <AdminFormField label="납부 유형"><AdminSelectDropdown disabled={busy || (targets[0].totalPaidAmount ?? 0) > 0} value={paymentType} onChange={value=>setPaymentType(value as typeof paymentType)} options={[{value:"SIX_SEMESTER_LUMP_SUM",label:"6학기 일시납"},{value:"PRIOR_PAYMENT_BALANCE",label:"기납부 차액"}]} /></AdminFormField>}
        <AdminFormField label="메모"><UiInput value={paymentNote} maxLength={500} onChange={event=>setPaymentNote(event.target.value)} /></AdminFormField></div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </Modal>
    <Modal open={Boolean(cancelPayment)} onClose={()=>{if(!busy)setCancelPayment(null);}} title="입금 기록 취소" footer={<><Button variant="outline" disabled={busy} onClick={()=>setCancelPayment(null)}>닫기</Button><Button variant="destructive" loading={busy} onClick={()=>void cancelReceipt()}>입금 취소 확정</Button></>}>
      <p className="mb-4">{detail?.record.nameKo} · {detail?.record.stdNo} · {money(cancelPayment?.amount ?? 0)} · {stamp(cancelPayment?.paidAt)}</p>
      <p className="mb-4 text-sm">잘못 등록한 입금 기록을 취소합니다. 실제 계좌의 환불은 실행하지 않습니다. 올바른 입금은 취소 후 다시 등록할 수 있습니다.</p>
      <AdminFormField label="취소 사유 (필수)"><UiInput value={cancelReason} maxLength={500} onChange={event=>setCancelReason(event.target.value)} /></AdminFormField>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={revokeRecognition} onChange={event=>setRevokeRecognition(event.target.checked)} /><span>이 입금으로 잘못 처리된 완납 인정도 취소</span></label><p className="mt-2 text-xs text-slate-500">선택하지 않으면 기존 완납 인정은 유지됩니다. 정당한 기납부자의 인정 취소에는 사용하지 마세요.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </Modal>

  </AdminPageShell></AuthGuard>;
}
