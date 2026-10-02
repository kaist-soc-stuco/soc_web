import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";

export function useDownloadReasonDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);
  const close = useCallback((value: string | null) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }, []);
  const promptDownloadReason = useCallback(() => {
    resolveRef.current?.(null);
    setReason(""); setInvalid(false); setOpen(true);
    return new Promise<string | null>(resolve => { resolveRef.current = resolve; });
  }, []);
  useEffect(() => () => { resolveRef.current?.(null); }, []);
  const submit = () => {
    const value = reason.trim();
    if (value.length < 2 || value.length > 200) { setInvalid(true); return; }
    close(value);
  };
  const DownloadReasonDialog = <Modal open={open} onClose={() => close(null)} title="다운로드 사유" size="compact" footer={<><Button variant="outline" onClick={() => close(null)}>취소</Button><Button onClick={submit}>다운로드</Button></>}>
    <form onSubmit={event => { event.preventDefault(); submit(); }} className="space-y-3">
      <label htmlFor="download-reason" className="block text-sm text-slate-600">개인정보를 내려받는 사유를 입력해 주세요.</label>
      <UiInput autoFocus id="download-reason" value={reason} maxLength={200} aria-invalid={invalid} aria-describedby="download-reason-help" onChange={event => { setReason(event.target.value); setInvalid(false); }} />
      <p id="download-reason-help" role={invalid ? "alert" : undefined} className={invalid ? "text-sm text-rose-600" : "text-xs text-slate-500"}>{invalid ? "다운로드 사유를 2~200자로 입력해 주세요." : "2~200자"}</p>
    </form>
  </Modal>;
  return { promptDownloadReason, DownloadReasonDialog };
}
