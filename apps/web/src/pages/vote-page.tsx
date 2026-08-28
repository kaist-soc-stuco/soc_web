import { createApiClient, ApiClientHttpError } from "@soc/api-client";
import type { VoteDetailResponse, VoteResultsResponse } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";
import { Check, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContainer, PageMain, PageShell } from "@/components/ui/page-layout";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

const formatDateTime = (value: string, locale: string) => new Intl.DateTimeFormat(locale, {
  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(isoToMs(value));

export function VotePage() {
  const { lang } = useLanguage();
  const { id = "" } = useParams();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [vote, setVote] = useState<VoteDetailResponse | null>(null);
  const [results, setResults] = useState<VoteResultsResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptVerified, setReceiptVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const t = lang === "ko" ? {
    back: "← 투표 목록", private: "전산학부 주전생 대상 · 개인별 선택은 관리자에게 공개되지 않습니다.", submitted: "투표가 제출되었습니다.",
    receiptHelp: "영수증 코드는 투표 내용이 아니라 정상 접수 여부를 확인하는 용도입니다.", verify: "접수 확인", verified: "정상 접수 확인됨",
    results: "투표 결과", ballots: "표", notStarted: "아직 투표가 시작되지 않았습니다.", ended: "투표가 종료되었습니다. 결과는 공개 후 확인할 수 있습니다.",
    loginHelp: "투표 자격 확인을 위해 로그인해 주세요.", login: "로그인", ineligible: "게시 시점의 전산학부 주전생 명부에 포함되지 않아 참여할 수 없습니다.",
    voted: "이미 투표를 제출했습니다.", submit: "투표 제출", submitting: "제출 중", required: "모든 문항에 응답해 주세요.",
    confirmTitle: "투표를 제출할까요?", confirmDescription: "제출한 뒤에는 선택을 확인하거나 수정할 수 없습니다.", confirmLabel: "제출",
  } : {
    back: "← All votes", private: "School of Computing primary majors only · Individual choices are never shown to administrators.", submitted: "Your ballot was submitted.",
    receiptHelp: "This receipt verifies acceptance only; it does not reveal your selections.", verify: "Verify receipt", verified: "Receipt verified",
    results: "Results", ballots: "ballots", notStarted: "Voting has not started yet.", ended: "Voting has ended. Results will appear after publication.",
    loginHelp: "Sign in to verify your eligibility.", login: "Sign in", ineligible: "You are not included in the primary-major voter roll fixed at publication.",
    voted: "You have already submitted a ballot.", submit: "Submit ballot", submitting: "Submitting", required: "Please answer every question.",
    confirmTitle: "Submit this ballot?", confirmDescription: "You cannot review or change your selections after submission.", confirmLabel: "Submit",
  };

  useEffect(() => {
    void client.getVote(id).then((data) => {
      setVote(data);
      if (data.resultsPublishedAt) void client.getVoteResults(id).then(setResults).catch(() => undefined);
    }).catch(() => setError("투표를 불러오지 못했습니다."));
  }, [client, id]);

  const select = (itemId: string, optionId: string, multiple: boolean, maxSelections: number) => {
    setAnswers((current) => {
      const selected = current[itemId] ?? [];
      if (!multiple) return { ...current, [itemId]: [optionId] };
      if (selected.includes(optionId)) return { ...current, [itemId]: selected.filter((id) => id !== optionId) };
      if (selected.length >= maxSelections) return current;
      return { ...current, [itemId]: [...selected, optionId] };
    });
  };

  const submit = async () => {
    if (!vote || vote.items.some((item) => !(answers[item.id]?.length))) {
      setError(t.required);
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
      setError(code === "vote_already_submitted" ? "이미 투표를 제출했습니다." : "투표를 제출하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !vote) return <PageShell><Header /><main className="flex-1 py-24 text-center text-sm text-rose-600">{error}</main></PageShell>;
  if (!vote) return <PageShell><Header /><main className="flex-1 py-24 text-center text-sm text-[#344054]">불러오는 중...</main></PageShell>;

  const now = nowMs();
  const isOpen = vote.status === "PUBLISHED" && now >= isoToMs(vote.startsAt) && now < isoToMs(vote.endsAt);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageContainer className="max-w-[54rem] py-10 pb-16">
          <Link to="/votes" className="text-sm font-normal text-[#344054] hover:text-brand-primary">{t.back}</Link>
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} />
              <span className="text-xs font-normal text-[#344054]">{formatDateTime(vote.startsAt, lang === "ko" ? "ko-KR" : "en-US")} – {formatDateTime(vote.endsAt, lang === "ko" ? "ko-KR" : "en-US")}</span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.03em] text-[#172033]">{lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo}</h1>
            {(lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo) ? <p className="mt-3 whitespace-pre-wrap text-sm font-normal leading-6 text-[#344054]">{lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo}</p> : null}
            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs font-normal text-[#344054]">
              <LockKeyhole className="size-4 text-brand-primary" /> {t.private}
            </div>
          </section>

          {receipt ? (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-8 text-center">
              <Check className="mx-auto size-8 text-emerald-700" />
              <h2 className="mt-3 text-xl font-semibold text-[#172033]">{t.submitted}</h2>
              <p className="mt-2 text-sm font-normal text-[#344054]">{t.receiptHelp}</p>
              <code className="mt-5 inline-block rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-normal text-[#172033]">{receipt}</code>
              <div className="mt-4"><Button variant="outline" size="sm" onClick={async () => setReceiptVerified((await client.verifyVoteReceipt(id, receipt)).accepted)}>{receiptVerified ? t.verified : t.verify}</Button></div>
            </section>
          ) : results ? (
            <section className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-6 md:p-8">
              <h2 className="text-xl font-semibold text-[#172033]">{t.results}</h2>
              <p className="text-sm font-normal text-[#344054]">{lang === "ko" ? `총 ${results.totalBallots}표` : `${results.totalBallots} ${t.ballots}`}</p>
              {results.items.map((item) => (
                <div key={item.itemId} className="border-t border-slate-100 pt-5">
                  <h3 className="font-medium text-[#172033]">{lang === "en" && item.titleEn ? item.titleEn : item.titleKo}</h3>
                  <div className="mt-3 space-y-3">
                    {item.options.map((option) => (
                      <div key={option.optionId}>
                        <div className="flex justify-between text-sm font-normal text-[#344054]"><span>{lang === "en" && option.labelEn ? option.labelEn : option.labelKo}</span><span>{option.count}{lang === "ko" ? "표" : ""} · {option.percentage}%</span></div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-primary" style={{ width: `${option.percentage}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : !isOpen ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white py-14 text-center text-sm font-normal text-[#344054]">
              {now < isoToMs(vote.startsAt) ? t.notStarted : t.ended}
            </div>
          ) : vote.eligibility === "LOGIN_REQUIRED" ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white py-14 text-center">
              <p className="text-sm font-normal text-[#344054]">{t.loginHelp}</p>
              <Button asChild className="mt-5"><Link to="/login">{t.login}</Link></Button>
            </div>
          ) : vote.eligibility === "NOT_ELIGIBLE" ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white py-14 text-center text-sm font-normal text-[#344054]">{t.ineligible}</div>
          ) : vote.eligibility === "ALREADY_VOTED" ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white py-14 text-center text-sm font-normal text-[#344054]">{t.voted}</div>
          ) : (
            <section className="mt-5 space-y-5">
              {vote.items.map((item, index) => (
                <section key={item.id} role="group" aria-labelledby={`vote-item-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 id={`vote-item-${item.id}`} className="text-base font-semibold text-[#172033]">{index + 1}. {lang === "en" && item.titleEn ? item.titleEn : item.titleKo}</h2>
                  {(lang === "en" && item.descriptionEn ? item.descriptionEn : item.descriptionKo) ? <p className="mt-2 text-sm font-normal text-[#344054]">{lang === "en" && item.descriptionEn ? item.descriptionEn : item.descriptionKo}</p> : null}
                  {item.type === "MULTIPLE_CHOICE" ? <p className="mt-2 text-xs font-normal text-[#344054]">{lang === "ko" ? `최대 ${item.maxSelections}개 선택` : `Select up to ${item.maxSelections}`}</p> : null}
                  <div className="mt-4 grid gap-2">
                    {item.options.map((option) => {
                      const checked = answers[item.id]?.includes(option.id) ?? false;
                      const disabled = item.type === "MULTIPLE_CHOICE" && !checked && (answers[item.id]?.length ?? 0) >= item.maxSelections;
                      return (
                        <label key={option.id} className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${checked ? "border-brand-primary bg-emerald-50/40" : "border-slate-200 hover:bg-slate-50"}`}>
                          <input type={item.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={item.id} checked={checked} disabled={disabled} onChange={() => select(item.id, option.id, item.type === "MULTIPLE_CHOICE", item.maxSelections)} className="mt-0.5 accent-[var(--color-primary)]" />
                          <span><span className="block text-sm font-normal text-[#172033]">{lang === "en" && option.labelEn ? option.labelEn : option.labelKo}</span>{(lang === "en" && option.descriptionEn ? option.descriptionEn : option.descriptionKo) ? <span className="mt-1 block text-xs font-normal text-[#344054]">{lang === "en" && option.descriptionEn ? option.descriptionEn : option.descriptionKo}</span> : null}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
              {error ? <p className="text-sm font-normal text-rose-600">{error}</p> : null}
              <div className="flex justify-end"><Button onClick={() => void submit()} disabled={submitting}>{submitting ? t.submitting : t.submit}</Button></div>
            </section>
          )}
        </PageContainer>
      </PageMain>
      {ConfirmDialog}
    </PageShell>
  );
}
