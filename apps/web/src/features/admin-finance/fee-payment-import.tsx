import { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { StudentFeePaymentImportPreview, StudentFeePaymentImportRow } from "@soc/contracts";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createFeePaymentTemplate, parseFeePaymentSpreadsheet } from "@/lib/fee-payment-spreadsheet";
import { downloadBlob } from "@/lib/download-blob";
import { resolveApiBaseUrl } from "@/lib/api";
import { randomId } from "@/lib/random-id";

export function FeePaymentImport({ disabled, onImported }: { disabled: boolean; onImported: () => Promise<void> }) {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidate, setCandidate] = useState<{ entries: StudentFeePaymentImportRow[]; preview: StudentFeePaymentImportPreview; key: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duplicates = candidate?.preview.rows.filter(row => row.duplicate).length ?? 0;
  const hasErrors = candidate?.preview.rows.some(row => row.error) ?? false;
  const save = async () => {
    if (!candidate || hasErrors || (duplicates > 0 && !confirmed) || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(null);
    try {
      const result = await client.importStudentFeePayments({ entries: candidate.entries, idempotencyKey: candidate.key, confirmDuplicates: confirmed });
      setCandidate(null);
      setOpen(false);
      toast({ type: "success", message: `${result.count}건의 입금을 등록했습니다.` });
      try { await onImported(); }
      catch { toast({ type: "error", message: "입금 등록은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요." }); }
    } catch (cause) {
      const code = cause instanceof ApiClientHttpError ? cause.code : undefined;
      const messages: Record<string, string> = {
        fee_import_name_mismatch: "이름 정보가 달라졌습니다. 파일과 명부를 확인한 뒤 다시 가져와 주세요.",
        fee_import_duplicates_changed: "같은 입금 내역이 추가로 확인되었습니다. 다시 가져와 중복 의심 내역을 확인해 주세요.",
        fee_already_paid: "이미 완납 처리된 학생이 있습니다. 최신 납부 내역을 확인한 뒤 다시 가져와 주세요.",
        fee_payment_exceeds_balance: "현재 미납 차액을 초과한 입금이 있습니다. 최신 납부 내역을 확인해 주세요.",
      };
      setError(messages[code ?? ""] ?? "입금을 등록하지 못했습니다. 다시 시도해 주세요. 같은 창에서 재시도해도 중복 등록되지 않습니다.");
    } finally { inFlight.current = false; setSaving(false); }
  };
  return <>
    <Button variant="outline" disabled={disabled || saving} onClick={() => setOpen(true)}><Upload />입금 엑셀 가져오기</Button>
    <input ref={input} type="file" accept=".xlsx" className="hidden" aria-label="입금 엑셀 파일" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file || disabled || loading || saving) return;
      if (file.size > 5 * 1024 * 1024) { toast({ type: "error", message: "5MB 이하의 엑셀 파일을 선택해 주세요." }); return; }
      setLoading(true); setError(null); setConfirmed(false);
      try {
        const entries = parseFeePaymentSpreadsheet(await file.arrayBuffer());
        const preview = await client.previewStudentFeePayments(entries);
        setCandidate({ entries, preview, key: randomId() });
      } catch (cause) { toast({ type: "error", message: cause instanceof ApiClientHttpError ? "입금 확인표를 불러오지 못했습니다. 다시 시도해 주세요." : cause instanceof Error ? cause.message : "엑셀 파일을 확인해 주세요." }); }
      finally { setLoading(false); }
    }} />
    <Modal size={candidate ? "wide" : "standard"} open={open} onClose={() => { if (!saving && !loading) { setCandidate(null); setOpen(false); setError(null); } }} title="입금 엑셀 가져오기" footer={candidate ? <>
      <span className="mr-auto text-sm font-medium">{candidate?.entries.length ?? 0}건 · 합계 {(candidate?.preview.totalAmount ?? 0).toLocaleString("ko-KR")}원 · 신규 명부 {candidate?.preview.newPeopleCount ?? 0}명</span>
      <Button variant="outline" disabled={saving} onClick={() => { setCandidate(null); setError(null); }}>파일 다시 선택</Button>
      <Button loading={saving} disabled={hasErrors || (duplicates > 0 && !confirmed) || saving} onClick={() => void save()}>입금 등록</Button>
    </> : <Button variant="outline" disabled={loading} onClick={() => { setOpen(false); setError(null); }}>취소</Button>}>
      {!candidate ? <div className="space-y-5 text-sm leading-6">
        <p>양식을 내려받아 이번에 받은 입금을 한 건씩 작성한 뒤 엑셀 파일을 선택해 주세요. 등록 전에 입금 내역과 합계를 확인할 수 있습니다.</p>
        <Button variant="outline" onClick={() => {
          try { downloadBlob(createFeePaymentTemplate(), "입금 등록 양식.xlsx"); }
          catch { toast({ type: "error", message: "입금 양식을 내려받지 못했습니다. 다시 시도해 주세요." }); }
        }}><Download />입금 양식 다운로드</Button>
        <Button variant="outline" className="flex min-h-32 w-full flex-col gap-3 border-dashed" loading={loading} disabled={loading} onClick={() => input.current?.click()}><Upload />엑셀 파일 선택</Button>
      </div> : <>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200">
        {['학번', '이름', '입금일', '입금액', '확인 사항'].map(label => <th key={label} className="whitespace-nowrap p-2">{label}</th>)}
      </tr></thead><tbody>{candidate?.preview.rows.map((row, index) => <tr key={index} className="border-b border-slate-100">
        <td className="p-2 tabular-nums">{row.stdNo}</td><td className="p-2">{row.nameKo}</td><td className="whitespace-nowrap p-2">{row.paidDate}</td>
        <td className="whitespace-nowrap p-2 text-right tabular-nums">{row.amount.toLocaleString("ko-KR")}원</td>
        <td className={`p-2 ${row.error ? "text-rose-700" : row.duplicate ? "text-amber-700" : "text-slate-500"}`}>{row.error ?? [row.isNewPerson ? "명부에 추가" : "기존 학생", row.duplicate ? "중복 의심" : ""].filter(Boolean).join(" · ")}</td>
      </tr>)}</tbody></table></div>
      {hasErrors && <p role="alert" className="mt-3 text-sm text-rose-700">오류가 있는 행을 파일에서 수정한 뒤 다시 가져와 주세요. 아직 등록된 입금은 없습니다.</p>}
      {duplicates > 0 && <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} /><span>중복 의심 {duplicates}건을 확인했으며, 별도의 실제 입금임을 확인했습니다.</span></label>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      </>}
    </Modal>
  </>;
}
