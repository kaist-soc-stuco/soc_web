import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";

export function FeeConsentPanel({ lang }: { lang: string }) {
  const ko = lang === "ko";
  const isMobile = useMediaQuery("(max-width: 767px)");
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (location.hash === "#fee-consent") setExpanded(true); }, [location.hash]);
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const { data: session } = useCurrentSession();
  const [accepted, setAccepted] = useState(false);
  const queryKey = ["student-fee-consent", session?.userId];
  const consent = useQuery({ queryKey, enabled: Boolean(session?.userId && session.canUsePersistentFeatures), queryFn: () => client.getStudentFeeConsent() });
  const save = useMutation({
    mutationFn: (consented: boolean) => {
      if (!consent.data) throw new Error("fee_consent_unavailable");
      return client.setStudentFeeConsent({ semester: consent.data.semester, noticeVersion: consent.data.noticeVersion, consented });
    },
    onSuccess: data => { queryClient.setQueryData(queryKey, data); setAccepted(false); },
    onError: () => { setAccepted(false); void consent.refetch(); },
  });
  const semester = consent.data?.semester.replace(/^(\d{4})-([12])$/, ko ? "$1학년도 $2학기" : "$1 · Semester $2");
  return <section id="fee-consent" className="mypage-fee-consent scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    {isMobile ? <button type="button" className="mobile-fee-disclosure" aria-expanded={expanded} aria-controls="fee-consent-content" onClick={() => setExpanded(value => !value)}><span><strong>{ko ? "과비 개인정보 동의" : "Student-fee privacy consent"}</strong><small>{consent.data ? `${semester} · ${consent.data.consented ? ko ? "동의 완료" : "Consented" : ko ? "동의 필요" : "Consent required"}` : ko ? "동의 상태 확인" : "Review consent"}</small></span><ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : ""} /></button> : <h2 className="text-sm font-semibold text-slate-900">{ko ? "과비 개인정보 동의" : "Student-fee privacy consent"}</h2>}
    <div id="fee-consent-content" hidden={isMobile && !expanded}>
    {consent.isLoading ? <p className="mt-3 text-sm text-slate-500">{ko ? "불러오는 중…" : "Loading…"}</p> : consent.isError ?
      <div className="mt-3 text-sm"><p>{ko ? "동의 상태를 불러오지 못했습니다." : "Could not load your consent status."}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void consent.refetch()}>{ko ? "다시 시도" : "Retry"}</Button></div> : consent.data ? <>
        <p className="mt-2 text-sm text-slate-600">{semester} · {consent.data.consented ? ko ? "동의 완료" : "Consented" : ko ? "동의 필요" : "Consent required"}</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">{ko ? "학기별 과비 납부 확인과 납부자 대상 사업 운영을 위해 이름, 학번, 이메일, 납부 내역을 이용합니다. 납부 기록과 완납 여부는 동의·철회 여부와 별도로 유지됩니다." : "Your name, student number, email, and payment records are used to verify fees and administer fee-payer activities for this semester. Your payment history and completion status are maintained separately from consent."}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{ko ? "동의를 거부하거나 철회할 수 있으며, 이 경우 해당 학기 납부자 대상 사업 참여가 제한됩니다. 보관·파기 기준은 " : "You may decline or withdraw consent; fee-payer activities will then be unavailable for this semester. Retention and deletion follow our "}<Link to="/privacy" className="underline underline-offset-2">{ko ? "개인정보처리방침" : "Privacy Policy"}</Link>{ko ? "을 따릅니다." : "."}</p>
        {consent.data.consented ? <Button variant="outline" size="sm" className="mt-4" disabled={save.isPending} onClick={() => save.mutate(false)}>{ko ? "이번 학기 동의 철회" : "Withdraw this semester's consent"}</Button> : <>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={accepted} disabled={save.isPending} onChange={event => setAccepted(event.target.checked)} className="mt-1 accent-emerald-700" /><span>{ko ? "위 내용을 확인했으며, 이번 학기 개인정보 이용에 동의합니다." : "I have read the notice and consent to this semester's use of my personal information."}</span></label>
          <Button size="sm" className="mt-4" disabled={!accepted || save.isPending} onClick={() => save.mutate(true)}>{ko ? "동의 완료" : "Confirm consent"}</Button>
        </>}
        {save.isError && <p role="alert" className="mt-3 text-sm text-rose-700">{ko ? "저장하지 못했습니다. 동의 내용을 다시 확인한 뒤 시도해 주세요." : "Could not save. Please review the current notice and try again."}</p>}
      </> : null}
    </div>
  </section>;
}
