import { stripRichText } from "@/components/ui/rich-text-content";
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";
import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/data-state";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatVotePeriod, getVoteListState } from "@/lib/vote-display";
import "@/features/events-surveys/events-surveys-cards.css";
import "@/features/votes/vote-list.css";
import { useLanguage } from "@/hooks/use-language";

function isOngoingVote(vote: VoteRecord, now: number) {
  return getVoteListState(vote, now) === "open";
}

function isUpcomingVote(vote: VoteRecord, now: number) {
  return getVoteListState(vote, now) === "upcoming";
}

function VoteCard({ vote, lang, now }: { vote: VoteRecord; lang: string; now: number }) {
  const title = stripRichText(lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo);
  const description = stripRichText(lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo ?? "");
  const state = getVoteListState(vote, now);
  const upcoming = state === "upcoming";
  const open = state === "open";
  const status = lang === "ko" ? upcoming ? "투표 예정" : open ? "진행 중" : "투표 종료" : upcoming ? "Upcoming" : open ? "Open" : "Voting ended";
  const content = <div className="discovery-card-copy">
    <p className="discovery-card-date" title={formatVotePeriod(vote.startsAt, vote.endsAt)}>{formatVotePeriod(vote.startsAt, vote.endsAt)}</p>
    <h3 className="discovery-card-title">{title}</h3>
    {description && <p className="vote-list-description">{description}</p>}
    <div className="discovery-card-footer">
      <div className="discovery-card-bottom">
        <div className="discovery-card-badges">
          <span className={`discovery-badge is-${upcoming ? "neutral" : open ? "open" : "closed"}`}>{status}</span>
          <span className="vote-list-participants tabular-nums">{lang === "ko" ? "참여" : "Participation"} {vote.votedCount}/{vote.eligibleCount}{lang === "ko" ? "명" : " voters"}</span>
        </div>
        {!upcoming && <span className="discovery-survey-cta">{lang === "ko" ? open ? "투표 참여" : "결과 보기" : open ? "Vote" : "View results"}<ArrowRight aria-hidden="true" /></span>}
      </div>
    </div>
  </div>;

  return (
    <article className={`discovery-card is-survey vote-list-card${upcoming ? " is-upcoming" : ""}`}>
      {upcoming ? <div className="discovery-card-link" aria-disabled="true">{content}</div>
        : <Link to={`/votes/${vote.id}`} target="_blank" rel="noopener noreferrer" className="discovery-card-link">{content}</Link>}
    </article>
  );
}

export function VoteListPage() {
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const error = loadFailed ? (lang === "ko" ? "투표 목록을 불러오지 못했습니다." : "Failed to load votes.") : null;
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void client
      .listPublicVotes()
      .then(result => { if (active) setVotes(result); })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, reloadKey, session?.userId, session?.permission]);

  const now = nowMs();
  const filteredVotes = votes;
  const ongoingVotes = filteredVotes.filter((vote) => isOngoingVote(vote, now));
  const upcomingVotes = filteredVotes.filter((vote) => isUpcomingVote(vote, now));
  const featuredVotes = [...ongoingVotes, ...upcomingVotes].sort((left, right) => {
    const leftIsOngoing = isOngoingVote(left, now);
    const rightIsOngoing = isOngoingVote(right, now);
    if (leftIsOngoing !== rightIsOngoing) return leftIsOngoing ? -1 : 1;
    return isoToMs(left.startsAt) - isoToMs(right.startsAt);
  });
  const pastVotes = filteredVotes
    .filter((vote) => !isOngoingVote(vote, now) && !isUpcomingVote(vote, now))
    .sort((left, right) => isoToMs(right.startsAt) - isoToMs(left.startsAt));

  return (
    <PageShell className="discovery-page vote-list-page mobile-white-page">

      <PageMain>
        <PageHeader
          title={lang === "ko" ? "투표" : "Voting"}
          actions={Permissions.has(session?.permission ?? 0, Permissions.MANAGE_VOTE) ? <Button asChild><Link to="/admin/votes/new">{lang === "ko" ? "등록" : "Create"}</Link></Button> : undefined}
        />
        <PageContainer className="pb-16">
          {loading ? (
            <div className="min-h-48" aria-busy="true" aria-label={lang === "ko" ? "투표 목록 로딩" : "Loading votes"} />
          ) : error ? (
            <ErrorState
              description={
                lang === "ko"
                  ? "일시적인 네트워크 오류일 수 있습니다.\n잠시 후 다시 시도해 주세요."
                  : "This may be a temporary network issue. Please try again."
              }
              onRetry={() => setReloadKey((current) => current + 1)}
              retryLabel={lang === "ko" ? "다시 시도" : "Try again"}
              title={error}
            />
          ) : votes.length === 0 ? (
            <EmptyState className="min-h-48 rounded-none border-0 bg-transparent" message={lang === "ko" ? "현재 참여할 수 있는 투표가 없습니다." : "There are no votes available to you."} />
          ) : (
            <div>
              <section aria-labelledby="active-votes-title">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="active-votes-title" className="text-lg font-semibold tracking-[-0.02em] text-app-text-strong">
                    {lang === "ko" ? "예정·진행 중인 투표" : "Upcoming & open votes"}
                  </h2>
                  <span className="text-xs font-medium text-app-text-muted">
                    {featuredVotes.length}{lang === "ko" ? "개" : " active or upcoming"}
                  </span>
                </div>
                {featuredVotes.length > 0 ? (
                  <div className="discovery-grid">
                    {featuredVotes.map((vote) => (
                      <VoteCard key={vote.id} vote={vote} lang={lang} now={now} />
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-sm font-normal text-slate-500">
                    {lang === "ko" ? "현재 진행 중인 투표가 없습니다." : "There are no open votes right now."}
                  </p>
                )}
              </section>

              {pastVotes.length > 0 ? (
                <section className="mt-7" aria-labelledby="vote-history-title">
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="vote-history-title" className="text-lg font-semibold tracking-[-0.02em] text-app-text-strong">
                    {lang === "ko" ? "지난 투표" : "Past votes"}
                    </h2>
                    <span className="text-xs font-medium text-app-text-muted">
                      {pastVotes.length}{lang === "ko" ? "개" : " votes"}
                    </span>
                  </div>
                  <div className="discovery-grid">{pastVotes.map(vote => <VoteCard key={vote.id} vote={vote} lang={lang} now={now} />)}</div>
                </section>
              ) : null}
            </div>
          )}
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
