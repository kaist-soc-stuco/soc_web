import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatVoteDateTime, formatVotePeriod } from "@/lib/vote-display";
import { useLanguage } from "@/hooks/use-language";

function isOngoingVote(vote: VoteRecord, now: number) {
  return (
    vote.status === "PUBLISHED" &&
    isoToMs(vote.startsAt) <= now &&
    now < isoToMs(vote.endsAt)
  );
}

function isUpcomingVote(vote: VoteRecord, now: number) {
  return vote.status === "PUBLISHED" && isoToMs(vote.startsAt) > now;
}

function ActiveVoteCard({ vote, lang, now }: { vote: VoteRecord; lang: string; now: number }) {
  const title = lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo;
  const description =
    lang === "en" && vote.descriptionEn
      ? vote.descriptionEn
      : vote.descriptionKo;
  const upcoming = isUpcomingVote(vote, now);

  return (
    <Link
      to={`/votes/${vote.id}`}
      className="group block rounded-2xl border-2 border-brand-primary/30 bg-white p-5 shadow-[0_12px_32px_rgba(0,110,63,0.08)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-primary/55 hover:shadow-[0_16px_36px_rgba(0,110,63,0.13)] sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium tabular-nums text-app-text-muted">
          {upcoming
            ? lang === "ko"
              ? `시작 ${formatVoteDateTime(vote.startsAt)}`
              : `Starts ${formatVoteDateTime(vote.startsAt)}`
            : lang === "ko"
              ? `마감 ${formatVoteDateTime(vote.endsAt)}`
              : `Closes ${formatVoteDateTime(vote.endsAt)}`}
        </span>
      </div>
      <h3 className="mt-5 break-words text-xl font-semibold tracking-[-0.025em] text-app-text-strong sm:text-2xl">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 line-clamp-3 break-words text-sm font-normal leading-6 text-app-text-body">
          {description}
        </p>
      ) : null}
      <div className="mt-6 grid gap-3 border-y border-slate-100 py-4 text-sm sm:grid-cols-2">
        <div>
          <span className="block text-xs font-medium text-app-text-muted">
            {lang === "ko" ? "참여 현황" : "Participation"}
          </span>
          <strong className="mt-1 block font-semibold tabular-nums text-app-text-strong">
            {vote.votedCount}/{vote.eligibleCount}{lang === "ko" ? "명" : " voters"}
          </strong>
        </div>
        <div>
          <span className="block text-xs font-medium text-app-text-muted">
            {lang === "ko" ? "투표 기간" : "Voting period"}
          </span>
          <strong className="mt-1 block font-semibold tabular-nums text-app-text-strong">
            {formatVotePeriod(vote.startsAt, vote.endsAt)}
          </strong>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
        {lang === "ko" ? "투표하기" : "Vote now"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function VoteHistoryTable({ votes, lang }: { votes: VoteRecord[]; lang: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">
          {lang === "ko" ? "지난 투표 목록" : "Past votes"}
        </caption>
        <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-app-text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 sm:px-5">{lang === "ko" ? "투표" : "Vote"}</th>
            <th scope="col" className="w-52 px-4 py-3 sm:px-5">{lang === "ko" ? "기간" : "Period"}</th>
            <th scope="col" className="w-28 px-4 py-3 text-right sm:px-5">{lang === "ko" ? "참여" : "Turnout"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {votes.map((vote) => {
            const title = lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo;
            return (
              <tr key={vote.id} className="group transition-colors hover:bg-slate-50/75">
                <td className="max-w-0 px-4 py-4 align-middle sm:px-5">
                  <Link
                    to={`/votes/${vote.id}`}
                    className="block truncate font-semibold text-app-text-strong underline-offset-4 group-hover:text-brand-primary group-hover:underline"
                  >
                    {title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-4 align-middle text-xs tabular-nums text-app-text-muted sm:px-5">
                  {formatVotePeriod(vote.startsAt, vote.endsAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right align-middle text-xs tabular-nums text-app-text-body sm:px-5">
                  {vote.votedCount}/{vote.eligibleCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VoteListPage() {
  const { lang } = useLanguage();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void client
      .listPublicVotes()
      .then(setVotes)
      .catch(() => {
        setError(
          lang === "ko"
            ? "투표 목록을 불러오지 못했습니다."
            : "Failed to load votes.",
        );
      })
      .finally(() => setLoading(false));
  }, [client, lang, reloadKey]);

  const now = nowMs();
  const ongoingVotes = votes.filter((vote) => isOngoingVote(vote, now));
  const upcomingVotes = votes.filter((vote) => isUpcomingVote(vote, now));
  const featuredVotes = [...ongoingVotes, ...upcomingVotes].sort((left, right) => {
    const leftIsOngoing = isOngoingVote(left, now);
    const rightIsOngoing = isOngoingVote(right, now);
    if (leftIsOngoing !== rightIsOngoing) return leftIsOngoing ? -1 : 1;
    return isoToMs(left.startsAt) - isoToMs(right.startsAt);
  });
  const pastVotes = votes
    .filter((vote) => !isOngoingVote(vote, now) && !isUpcomingVote(vote, now))
    .sort((left, right) => isoToMs(right.startsAt) - isoToMs(left.startsAt));

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          title={lang === "ko" ? "투표" : "Voting"}
          containerClassName="max-w-4xl"
        />
        <PageContainer className="max-w-4xl pb-16">
          {loading ? (
            <div className="py-20 text-center text-sm font-normal text-[#344054]">
              {lang === "ko" ? "불러오는 중..." : "Loading..."}
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-12 text-center text-sm font-medium text-rose-700">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadKey((current) => current + 1)}
                className="min-h-11 border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-100"
              >
                {lang === "ko" ? "다시 시도" : "Try again"}
              </Button>
            </div>
          ) : votes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center text-sm font-normal text-[#344054]">
              {lang === "ko" ? "현재 공개된 투표가 없습니다." : "There are no published votes."}
            </div>
          ) : (
            <div>
              <section aria-labelledby="active-votes-title">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="active-votes-title" className="text-lg font-semibold tracking-[-0.02em] text-app-text-strong">
                    {lang === "ko" ? "진행 중인 투표" : "Open votes"}
                  </h2>
                  <span className="text-xs font-medium text-app-text-muted">
                    {featuredVotes.length}{lang === "ko" ? "개" : " active or upcoming"}
                  </span>
                </div>
                {featuredVotes.length > 0 ? (
                  <div className="grid gap-4">
                    {featuredVotes.map((vote) => (
                      <ActiveVoteCard key={vote.id} vote={vote} lang={lang} now={now} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center text-sm text-app-text-muted">
                    {lang === "ko" ? "현재 진행 중인 투표가 없습니다." : "There are no open votes right now."}
                  </div>
                )}
              </section>

              {pastVotes.length > 0 ? (
                <section className="mt-12" aria-labelledby="vote-history-title">
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="vote-history-title" className="text-lg font-semibold tracking-[-0.02em] text-app-text-strong">
                    {lang === "ko" ? "지난 투표" : "Past votes"}
                    </h2>
                    <span className="text-xs font-medium text-app-text-muted">
                      {pastVotes.length}{lang === "ko" ? "개" : " votes"}
                    </span>
                  </div>
                  <VoteHistoryTable votes={pastVotes} lang={lang} />
                </section>
              ) : null}
            </div>
          )}
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
