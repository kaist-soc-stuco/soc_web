import { ClosedView } from "@/features/survey/survey-state-views";
import { ResponsePageMain, ResponseHeaderCard } from "@/features/survey/response-layout";
import { SurveyParticipationNotice } from "@/features/survey/survey-participation-notice";
import { SurveyQuestionCard } from "@/features/survey/survey-question-card";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useToast } from "@/components/ui/toast";
import { VoteTurnout } from "@/components/organisms/vote-progress";
import { createApiClient, ApiClientHttpError } from "@soc/api-client";
import type { VoteDetailResponse, VoteResultsResponse } from "@soc/contracts";
import { isoToMs, nowMs, meetsVoteQuorum } from "@soc/shared";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";


import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContainer, PageMain, PageShell } from "@/components/ui/page-layout";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatVotePeriod } from "@/lib/vote-display";
import { useLanguage } from "@/hooks/use-language";

export function VotePage() {
  const { lang } = useLanguage();
  const { id = "" } = useParams();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [vote, setVote] = useState<VoteDetailResponse | null>(null);
  const [results, setResults] = useState<VoteResultsResponse | null>(null);
  const { toast } = useToast();
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptVerified, setReceiptVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const t = lang === "ko" ? {
    submitted: "투표가 제출되었습니다.",
    verify: "접수 확인", verified: "정상 접수 확인됨",
    results: "투표 결과", ballots: "표", notStarted: "아직 투표가 시작되지 않았습니다.", ended: "투표가 종료되었습니다. 결과는 공개 후 확인할 수 있습니다.",
    loginHelp: "투표 자격 확인을 위해 로그인해 주세요.", login: "로그인", ineligible: "이 투표의 참여 대상이 아닙니다.",
    voted: "이미 투표를 제출했습니다.", submit: "투표 제출", required: "모든 안건에 기표해 주세요.",
    confirmTitle: "투표를 제출할까요?", confirmDescription: "제출한 뒤에는 선택을 확인하거나 수정할 수 없습니다.", confirmLabel: "제출", loadFailed: "투표를 불러오지 못했습니다.", retry: "다시 시도",
  } : {
    submitted: "Your ballot was submitted.",
    verify: "Verify receipt", verified: "Receipt verified",
    results: "Results", ballots: "ballots", notStarted: "Voting has not started yet.", ended: "Voting has ended. Results will appear after publication.",
    loginHelp: "Sign in to verify your eligibility.", login: "Sign in", ineligible: "You are not eligible to participate in this vote.",
    voted: "You have already submitted a ballot.", submit: "Submit ballot", required: "Please vote on every agenda item.",
    confirmTitle: "Submit this ballot?", confirmDescription: "You cannot review or change your selections after submission.", confirmLabel: "Submit", loadFailed: "Failed to load this vote.", retry: "Try again",
  };

  useEffect(() => {
    setError(null);
    void client.getVote(id).then((data) => {
      setVote(data);
      if (data.resultsPublishedAt) void client.getVoteResults(id).then(setResults).catch(() => undefined);
    }).catch(() => setError(t.loadFailed));
  }, [client, id, reloadKey, t.loadFailed]);

  const selectionError = (item: VoteDetailResponse["items"][number]) => {
    const count = answers[item.id]?.length ?? 0;
    if (!count) return lang === "ko" ? "필수 입력란입니다." : "This question is required.";
    const rule = item.selectionRule ?? "max";
    if (item.type === "MULTIPLE_CHOICE" && ((rule !== "min" && count > item.maxSelections) || (rule !== "max" && count < item.maxSelections))) {
      return item.selectionErrorMessage?.trim() || (lang === "ko" ? `${rule === "min" ? "최소" : rule === "exact" ? "정확히" : "최대"} ${item.maxSelections}개를 선택해 주세요.` : `Select ${rule === "min" ? "at least" : rule === "exact" ? "exactly" : "at most"} ${item.maxSelections} options.`);
    }
    return undefined;
  };
  const submit = async () => {
    if (isPreview || submitting || !vote || vote.eligibility !== "ELIGIBLE" || vote.status !== "PUBLISHED" || nowMs() < isoToMs(vote.startsAt) || nowMs() >= isoToMs(vote.endsAt)) return;
    if (!vote || vote.items.some(item => selectionError(item))) {
      setValidationAttempted(true);
      const missing = vote?.items.find(item => selectionError(item));
      if (missing) document.getElementById(`vote-card-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const accepted = await confirm({
      title: t.confirmTitle,
      description: t.confirmDescription,
      confirmLabel: t.confirmLabel,
    });
    if (!accepted) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await client.submitVote(id, {
        answers: vote.items.map((item) => ({ itemId: item.id, optionIds: answers[item.id] ?? [] })),
      });
      setReceipt(result.receiptCode);
      setVote({ ...vote, eligibility: "ALREADY_VOTED", votedCount: vote.votedCount + 1 });
    } catch (caught) {
      const code = caught instanceof ApiClientHttpError ? caught.code : undefined;
      toast({ type: "error", message: code === "vote_already_submitted" ? "이미 투표를 제출했습니다." : "투표를 제출하지 못했습니다. 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !vote) return <PageShell><main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center text-sm text-rose-600" role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => setReloadKey((current) => current + 1)} className="min-h-11">{t.retry}</Button></main></PageShell>;
  if (!vote) return <PageShell><main className="flex-1 py-24 text-center text-sm text-[#344054]">불러오는 중...</main></PageShell>;

  const now = nowMs();
  const isOpen = vote.status === "PUBLISHED" && now >= isoToMs(vote.startsAt) && now < isoToMs(vote.endsAt);

  const showClosedNotice = !isPreview && !vote.resultsPublishedAt &&
    (vote.status === "CLOSED" || vote.status === "TALLIED" || now >= isoToMs(vote.endsAt));

  const canParticipate = isOpen && vote.eligibility === "ELIGIBLE";

  return (
    <PageShell>
      {isPreview && <header className="flex min-h-16 items-center border-b border-slate-200 bg-white px-6"><Link to={`/admin/votes/${id}`} className="inline-flex items-center gap-3 text-sm"><ArrowLeft className="size-4" />미리보기 모드</Link></header>}
      <ResponsePageMain>
          <ResponseHeaderCard title={lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo}>
            <p className="mt-2 text-sm tabular-nums text-slate-600">{formatVotePeriod(vote.startsAt, vote.endsAt)}</p>
            {(vote.descriptionKo || vote.descriptionEn) && <RichTextContent content={lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo ?? ""} className="mt-3 text-sm leading-6 text-slate-600" />}
            <div className="mt-4 border-t border-slate-100 pt-4"><VoteTurnout vote={vote} lang={lang} /></div>
          </ResponseHeaderCard>

          <div className="min-w-0">
          {showClosedNotice ? (
            <ClosedView lang={lang} subject="vote" />
          ) : !isPreview && receipt ? (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-8 text-center">
              <Check className="mx-auto size-8 text-emerald-700" />
              <h2 className="mt-3 text-xl font-semibold text-[#172033]">{t.submitted}</h2>
              <p className="mt-5 text-sm text-slate-500">{lang === "ko" ? "접수 번호" : "Receipt number"}</p>
              <code className="mt-2 inline-block max-w-full break-all rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-normal text-[#172033]">{receipt}</code>
              <div className="mt-4 flex justify-center gap-2"><Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(receipt); toast({ type: "success", message: lang === "ko" ? "접수 번호를 복사했습니다." : "Receipt number copied." }); } catch { toast({ type: "error", message: lang === "ko" ? "복사하지 못했습니다." : "Could not copy." }); } }}>{lang === "ko" ? "복사" : "Copy"}</Button><Button variant="outline" size="sm" onClick={async () => setReceiptVerified((await client.verifyVoteReceipt(id, receipt)).accepted)}>{receiptVerified ? t.verified : t.verify}</Button></div>
            </section>
          ) : !isPreview && results ? (
            <section className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 md:p-8">
              <h2 className="text-xl font-semibold text-[#172033]">{t.results}</h2>
              <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{lang === "ko" ? "최종 투표율" : "Final turnout"} {vote.eligibleCount ? (100 * results.totalBallots / vote.eligibleCount).toFixed(1) : "0.0"}% ({results.totalBallots}/{vote.eligibleCount})</p>{vote.quorumPercent !== null ? <span className="mt-2 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs">{meetsVoteQuorum(vote.eligibleCount, results.totalBallots, vote.quorumPercent, vote.quorumInclusive) ? "개표 정족수 충족" : "개표 정족수 미달"}</span> : null}</div>
              <p className="text-sm font-normal text-[#344054]">{lang === "ko" ? `총 ${results.totalBallots}표` : `${results.totalBallots} ${t.ballots}`}</p>
              {results.items.map((item) => (
                <div key={item.itemId} className="border-t border-slate-100 pt-5">
                  <h3 className="break-words font-medium text-[#172033]"><RichTextContent inline content={lang === "en" && item.titleEn ? item.titleEn : item.titleKo} /></h3>
                  <div className="mt-3 space-y-3">
                    {item.options.map((option) => (
                      <div key={option.optionId}>
                        <div className="flex flex-col gap-1 text-sm font-normal text-[#344054] sm:flex-row sm:items-baseline sm:justify-between"><span className="min-w-0 break-words">{lang === "en" && option.labelEn ? option.labelEn : option.labelKo}</span><span className="shrink-0 tabular-nums">{option.count}{lang === "ko" ? "표" : ""} · {option.percentage}%</span></div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${option.count > 0 && option.count === Math.max(...item.options.map(value => value.count)) ? "bg-emerald-500" : "bg-emerald-500"}`} style={{ width: `${option.percentage}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <>
            {!isPreview && !isOpen ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-14 text-center text-sm font-normal text-[#344054]">
              {now < isoToMs(vote.startsAt) ? t.notStarted : t.ended}
            </div>
          ) : !isPreview && vote.eligibility === "LOGIN_REQUIRED" ? (
            <SurveyParticipationNotice eligibility={{ status: "LOGIN_REQUIRED", reasons: ["LOGIN_REQUIRED"] }} lang={lang} subject="vote" />
          ) : !isPreview && vote.eligibility === "NOT_ELIGIBLE" ? (
            <SurveyParticipationNotice eligibility={{ status: "NOT_ELIGIBLE", reasons: [] }} lang={lang} subject="vote" description={t.ineligible} />
          ) : !isPreview && vote.eligibility === "ALREADY_VOTED" ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-14 text-center text-sm font-normal text-[#344054]">{t.voted}</div>
          ) : null}
            {isPreview || canParticipate ? (
              <section className="space-y-5">
                {vote.items.map(item => <SurveyQuestionCard key={item.id} id={`vote-card-${item.id}`} lang={lang}
                  question={{ id: item.id, titleKo: item.titleKo, titleEn: item.titleEn, descriptionKo: item.descriptionKo, descriptionEn: item.descriptionEn, isRequired: true,
                    questionType: item.type === "MULTIPLE_CHOICE" ? "multiple_choice" : "single_choice", config: item.imageUrl ? { imageUrlKo: item.imageUrl, imageUrlEn: item.imageUrl } : null,
                    options: item.options.map(option => ({ value: option.id, labelKo: option.labelKo, labelEn: option.labelEn ?? undefined, imageUrlKo: option.imageUrl, imageUrlEn: option.imageUrl })) }}
                  value={item.type === "MULTIPLE_CHOICE" ? answers[item.id] ?? [] : answers[item.id]?.[0] ?? ""}
                  onChange={value => setAnswers(current => ({ ...current, [item.id]: Array.isArray(value) ? value.slice(0, item.selectionRule === "min" ? item.options.length : item.maxSelections) : typeof value === "string" ? [value] : [] }))}
                  disabled={submitting}
                  maxSelections={item.type === "MULTIPLE_CHOICE" && item.selectionRule !== "min" ? item.maxSelections : undefined}
                  hint={item.type === "MULTIPLE_CHOICE" ? lang === "ko" ? `${item.selectionRule === "min" ? "최소" : item.selectionRule === "exact" ? "정확히" : "최대"} ${item.maxSelections}개 선택` : `Select ${item.selectionRule === "min" ? "at least" : item.selectionRule === "exact" ? "exactly" : "up to"} ${item.maxSelections}` : undefined}
                  error={validationAttempted ? selectionError(item) ?? null : null} />)}
                {error ? <p role="alert" aria-live="assertive" className="text-sm font-normal text-rose-600">{error}</p> : null}
                <div className="survey-response-actions flex justify-end px-0 py-3 md:py-0"><Button loading={submitting} className="min-h-11" onClick={() => void submit()} disabled={submitting || isPreview || !canParticipate}>{t.submit}</Button></div>
              </section>
            ) : null}
            </>
          )}
          </div>
      </ResponsePageMain>
      {ConfirmDialog}
    </PageShell>
  );
}
