import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { BulkProcessStudentFeePaymentsRequest, StudentFeePolicy, StudentFeeRosterDetailResponse, StudentFeeStatsResponse } from "@soc/contracts";
import { isoToDate, nowDate, nowIso, msToDate } from "@soc/shared";
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
import { feeRosterRow, feeRosterUpdate, type FeeRosterRow } from "@/lib/fee-roster";
import { FeeRosterPanel } from "./fee-roster-panel";
import { FeeStatisticsPanel } from "./fee-statistics-panel";
const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
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
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(nowIso().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentType, setPaymentType] = useState<"SIX_SEMESTER_LUMP_SUM" | "PRIOR_PAYMENT_BALANCE">("SIX_SEMESTER_LUMP_SUM");
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CASH" | "OTHER">("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const [correction, setCorrection] = useState<FeeRosterRow | null>(null);
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
    setTargets(rows); setError(null); setDate(nowIso().slice(0,10)); setPaymentNote(""); setPaymentMethod("BANK_TRANSFER");
    const previous = rows.length === 1 ? rows[0].totalPaidAmount ?? 0 : 0;
    setPaymentType(previous > 0 ? "PRIOR_PAYMENT_BALANCE" : "SIX_SEMESTER_LUMP_SUM");
    setAmount(String(remainingFee(rows[0])));
  };
  const submitPayment = async () => {
    if (!targets || busy) return;
    const paidAt = isoToDate(`${date}T00:00:00.000+09:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(paidAt.valueOf()) ||
      (targets.length === 1 && (!amount.trim() || !Number.isInteger(Number(amount)) || Number(amount) <= 0 || Number(amount) > remainingFee(targets[0])))) {
      setError("납부 일자와 금액을 확인해 주세요. 미납 차액을 초과할 수 없습니다."); return;
    }
    const recordingSemester = `${date.slice(0, 4)}-${Number(date.slice(5, 7)) <= 6 ? 1 : 2}`;
    const payments: BulkProcessStudentFeePaymentsRequest["payments"] = targets.map(row => ({ ...(row.userId ? { userId: row.userId } : { stdNo: row.stdNo }), amount: targets.length > 1 ? remainingFee(row) : Number(amount),
      paymentType: targets.length > 1 ? (row.totalPaidAmount ?? 0) > 0 ? "PRIOR_PAYMENT_BALANCE" : "SIX_SEMESTER_LUMP_SUM" : paymentType, paymentMethod,
      coverageSemesters: 6, effectiveStartSemester: recordingSemester, paidAt: paidAt.toISOString(), note: paymentNote.trim() || null }));
    const fingerprint = JSON.stringify(payments);
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = {fingerprint, key:randomId()};
    setBusy(true); setError(null);
    try { await client.processStudentFeePayments({idempotencyKey:idempotency.current.key, payments}); idempotency.current = null; setTargets(null); setSelected([]); await refresh(); toast({type:"success",message:`${payments.length}명의 납부 내역을 반영했습니다.`}); }
    catch { setError("납부 내역을 반영하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  const correct = async () => {
    if (!correction || busy) return;
    setBusy(true); setError(null);
    try { await client.saveStudentFeeRoster({records:[feeRosterUpdate(correction)]}); setCorrection(null); await refresh(); toast({type:"success",message:"기초자료를 정정했습니다."}); }
    catch { setError("정정하지 못했습니다. 입력값 또는 다른 관리자의 변경 여부를 확인해 주세요."); }
    finally { setBusy(false); }
  };
  const eligible = selected.filter(row => remainingFee(row) > 0);
  return <AuthGuard requireAnyPermission={[Permissions.VIEW_FINANCE, Permissions.MANAGE_FINANCE]}><AdminPageShell className={`admin-fee-page ${tab === "payments" ? "admin-fee-page--payments" : ""}`}>
    <AdminPageMain className="admin-fee-management !max-w-none !gap-4 md:!px-6 xl:!px-6">
      <AdminPageHeader title="과비 관리" actions={<AdminSelectDropdown className="w-48" ariaLabel="조회 학기" value={semester} disabled={dirty || busy} onChange={value => {setSemester(value); setDetailId(null);}} options={semesters} />} />
      <div className="flex flex-wrap items-center justify-between gap-3"><SegmentedControl variant="underline" role="tablist" className="w-fit" ariaLabel="과비 관리 보기" value={tab} onChange={value => {if (!dirty) setTab(value);}} options={[{value:"payments",label:"납부 관리"},{value:"stats",label:"통계"},...(canEdit ? [{value:"settings",label:"설정"}] : [])]} />

      </div>
      {policyError && <p role="alert" className="text-sm text-rose-700">표준 과비 설정을 불러오지 못했습니다.</p>}
      {tab === "payments" && <FeeRosterPanel canEdit={canEdit} canExport={canExport} semester={semester} revision={revision} onDirtyChange={setDirty} onSelectionChange={setSelected} onOpenDetail={openDetail} onSaved={saved} selectionAction={canEdit && selected.length > 0 ? <Button disabled={!eligible.length || dirty || busy || !policy} onClick={() => beginPayment(eligible)}>선택 납부 처리 ({eligible.length}명)</Button> : null} />}
      {tab === "stats" && <FeeStatisticsPanel stats={stats} loading={statsLoading} error={statsError} onRetry={() => void loadStats()} range={statsRange} displayedRange={statsRange} onRangeChange={setStatsRange} semester={semester} semesterOptions={semesters} onSemesterChange={setSemester} />}
      {tab === "settings" && <section className="flex items-end gap-3 rounded-xl border border-slate-200 p-5"><AdminFormField label="표준 과비 (원)"><UiInput type="number" min={1} value={policyAmount} onChange={event=>setPolicyAmount(event.target.value)} /></AdminFormField><Button loading={busy} disabled={!canEdit || !policy || busy} onClick={async()=>{if(!Number.isInteger(Number(policyAmount)) || Number(policyAmount)<=0) return; setBusy(true);try {setPolicy(await client.createStudentFeePolicy({effectiveSemester:semester,amount:Number(policyAmount),coverageSemesters:6}));setRevision(value=>value+1);toast({type:"success",message:"표준 금액을 저장했습니다."});}catch{toast({type:"error",message:"설정을 저장하지 못했습니다."});}finally{setBusy(false);}}}>저장</Button></section>}
    </AdminPageMain>
    <AdminDrawer open={Boolean(detailId)} onClose={()=>{detailRequest.current++;setDetailId(null);}} title={detail?.record.nameKo ? `${detail.record.nameKo} 납부 상세` : "납부 상세"} width="max-w-2xl">
      {detailLoading ? <AdminLoadingState /> : detail ? <div className="space-y-6">
        <div><h3 className="text-lg font-semibold">{detail.record.nameKo}</h3><p className="mt-1 text-sm text-slate-500">{detail.record.stdNo || "학번 없음"} · {detail.record.userId ? "가입" : "미가입"}{detail.record.email ? ` · ${detail.record.email}` : ""}</p></div>
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4 text-sm"><div><dt className="text-slate-500">납부 상태</dt><dd className="mt-2"><AdminStatusBadge tone={detail.record.status === "PAID" ? "positive" : detail.record.status === "PARTIAL" ? "warning" : "neutral"}>{detail.record.status === "PAID" ? "완납" : detail.record.status === "PARTIAL" ? "부분 납부" : "미납"}</AdminStatusBadge></dd></div><div><dt className="text-slate-500">누적 수납액</dt><dd className="mt-2 font-semibold tabular-nums">{money(detail.record.totalPaidAmount ?? 0)}</dd></div><div><dt className="text-slate-500">미납 차액</dt><dd className="mt-2">{money(detail.record.remainingAmount ?? 0)}</dd></div><div><dt className="text-slate-500">최근 납부</dt><dd className="mt-2">{stamp(detail.record.paidAt)}</dd></div></dl>
        <section><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">납부 이력</h3>{canEdit && <Button size="sm" disabled={dirty || !policy || remainingFee(feeRosterRow(detail.record)) <= 0} onClick={()=>beginPayment([feeRosterRow(detail.record)])}>납부 내역 추가</Button>}</div>
          {!detail.history.length && <p className="text-sm text-slate-500">등록된 납부 이력이 없습니다.</p>}
          <div className="divide-y divide-slate-100">{detail.history.map(payment=><div className="py-3 text-sm" key={payment.paymentId}><p className="font-medium">{money(payment.amount)} · {semesterLabel(payment.effectiveStartSemester)} 납부 기록</p><p className="mt-1 text-xs text-slate-500">{stamp(payment.paidAt)} · {payment.paymentType === "PRIOR_PAYMENT_BALANCE" ? "기납부 차액" : "6학기 일시납"} · {payment.paymentMethod === "BANK_TRANSFER" ? "계좌이체" : payment.paymentMethod === "CASH" ? "현금" : "기타"}{payment.note ? ` · ${payment.note}` : ""}</p></div>)}</div></section>
        <section className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">기초자료</h3>{canEdit && detail.record.stdNo && <Button size="sm" variant="outline" disabled={dirty} onClick={()=>{setError(null);setCorrection(feeRosterRow(detail.record));}}>기초자료 정정</Button>}</div><p className="mt-3 text-sm">초기 납부 금액 {money(detail.record.paidAmount)} · {detail.record.paidSemesters}학기</p>{detail.record.note && <p className="mt-2 text-sm text-slate-500">{detail.record.note}</p>}</section>
      </div> : <p className="text-sm text-slate-500">상세 정보를 불러오지 못했습니다.</p>}
    </AdminDrawer>
    <Modal open={Boolean(targets)} onClose={()=>{if(!busy)setTargets(null);}} title="납부 내역 추가" footer={<><Button variant="outline" disabled={busy} onClick={()=>setTargets(null)}>취소</Button><Button loading={busy} disabled={busy} onClick={()=>void submitPayment()}>납부 처리</Button></>}>
      <p className="mb-4 text-sm">{targets?.length === 1 ? targets[0].nameKo : `${targets?.length ?? 0}명`} · {targets && targets.length > 1 ? "각 대상자의 미납 차액만 기록합니다." : `미납 차액 ${money(targets ? remainingFee(targets[0]) : 0)}`}</p>
      <div className="grid gap-4 sm:grid-cols-2">{targets?.length === 1 && <AdminFormField label="납부 금액 (원)"><UiInput type="number" min={1} max={remainingFee(targets[0])} value={amount} onChange={event=>setAmount(event.target.value)} /></AdminFormField>}<AdminFormField label="납부 일자"><UiInput type="date" value={date} onChange={event=>setDate(event.target.value)} /></AdminFormField>
        <AdminFormField label="납부 유형"><AdminSelectDropdown value={paymentType} onChange={value=>setPaymentType(value as typeof paymentType)} options={[{value:"SIX_SEMESTER_LUMP_SUM",label:"6학기 일시납"},{value:"PRIOR_PAYMENT_BALANCE",label:"기납부 차액"}]} /></AdminFormField>
        <AdminFormField label="납부 방법"><AdminSelectDropdown value={paymentMethod} onChange={value=>setPaymentMethod(value as typeof paymentMethod)} options={[{value:"BANK_TRANSFER",label:"계좌이체"},{value:"CASH",label:"현금"},{value:"OTHER",label:"기타"}]} /></AdminFormField>
        <AdminFormField label="메모"><UiInput value={paymentNote} maxLength={500} onChange={event=>setPaymentNote(event.target.value)} /></AdminFormField></div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </Modal>
    <Modal open={Boolean(correction)} onClose={()=>{if(!busy)setCorrection(null);}} title="기초자료 정정" footer={<><Button variant="outline" disabled={busy} onClick={()=>setCorrection(null)}>취소</Button><Button loading={busy} onClick={()=>void correct()}>저장</Button></>}>
      <p className="mb-4 text-sm">초기 자료의 오류를 정정합니다. 신규 납부 이력은 변경되지 않습니다.</p>
      {correction && <div className="grid gap-4 sm:grid-cols-2">{([{key:"nameKo",label:"이름",type:"text"},{key:"admissionYear",label:"입학 연도",type:"number"},{key:"paidAmount",label:"초기 납부 금액 (원)",type:"number"},{key:"paidSemesters",label:"초기 납부 학기 수",type:"number"},{key:"note",label:"비고",type:"text"}] as const).map(field=><AdminFormField key={field.key} label={field.label}><UiInput type={field.type} value={correction[field.key]} onChange={event=>setCorrection(current=>current ? {...current,[field.key]:event.target.value} : current)} /></AdminFormField>)}</div>}{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </Modal>
  </AdminPageShell></AuthGuard>;
}
