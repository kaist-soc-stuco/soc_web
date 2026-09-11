import { createApiClient } from "@soc/api-client";
import { nowMs } from "@soc/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api";

type Participation = { id: string; title: string; href: string; kind: string; start: number; end: number };

export function HomeParticipation() {
  const { lang } = useLanguage();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [items, setItems] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      const results = await Promise.allSettled([client.getArticles("_EVENT", { limit: 100 }), client.getPublicSurveys({ pageSize: 100 }), client.listPublicVotes()]);
      if (!active) return;
      const next: Participation[] = [];
      const linked = new Set<string>();
      const title = (ko: string, en?: string | null) => lang === "en" ? en || ko : ko;
      if (results[0].status === "fulfilled") for (const event of results[0].value.items) {
        if (event.status !== "PUBLISHED" || event.isSecret || event.visibilityScope !== "PUBLIC" || event.homeVisible === false) continue;
        const end = event.eventEndDate ? Date.parse(event.eventEndDate) : Infinity;
        if (end < nowMs()) continue;
        if (event.surveyId) linked.add(event.surveyId);
        next.push({ id: `event:${event.articleId}`, title: title(event.titleKo, event.titleEn), href: `/events/${event.articleId}`, kind: lang === "ko" ? "행사" : "Event", start: event.eventStartDate ? Date.parse(event.eventStartDate) : 0, end });
      }
      if (results[1].status === "fulfilled") for (const survey of results[1].value.items) {
        if (linked.has(survey.id) || !["open", "before_open"].includes(survey.computedState)) continue;
        next.push({ id: `survey:${survey.id}`, title: title(survey.titleKo, survey.titleEn), href: `/survey/${survey.id}`, kind: lang === "ko" ? "설문 · 신청" : "Survey", start: survey.opensAt ? Date.parse(survey.opensAt) : 0, end: survey.closesAt ? Date.parse(survey.closesAt) : Infinity });
      }
      if (results[2].status === "fulfilled") for (const vote of results[2].value) {
        if (vote.status !== "PUBLISHED" || Date.parse(vote.endsAt) < nowMs()) continue;
        next.push({ id: `vote:${vote.id}`, title: title(vote.titleKo, vote.titleEn), href: `/votes/${vote.id}`, kind: lang === "ko" ? "투표" : "Vote", start: Date.parse(vote.startsAt), end: Date.parse(vote.endsAt) });
      }
      const now = nowMs();
      next.sort((a, b) => Number(a.start > now) - Number(b.start > now) || a.end - b.end || a.id.localeCompare(b.id));
      setItems(next.slice(0, 3));
      setFailed(results.some((result) => result.status === "rejected"));
      setLoading(false);
      pending = false;
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [client, lang]);
  return <section className="min-w-0 bg-slate-50 px-5 py-6 sm:px-8" aria-labelledby="home-participation-title">
    <h2 id="home-participation-title" className="text-xl font-semibold text-slate-900">{lang === "ko" ? "지금 참여할 수 있어요" : "Get involved"}</h2>
    <p className="mt-1 text-sm text-slate-600">{lang === "ko" ? "진행 중인 행사와 설문, 투표를 확인하세요." : "Explore events, surveys and votes."}</p>
    <div className="mt-4 grid gap-2">
      {items.map((item) => <Link key={item.id} to={item.href} className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
        <span className="text-xs text-slate-500">{item.kind} · {item.start > nowMs() ? (lang === "ko" ? "예정" : "Upcoming") : (lang === "ko" ? "진행 중" : "Open")}</span>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</h3>
        <p className="mt-1 text-xs text-slate-600">{Number.isFinite(item.end) ? `${new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(item.end)} ${lang === "ko" ? "마감" : "deadline"}` : lang === "ko" ? "상시" : "Always open"} · {lang === "ko" ? "참여 조건 확인 →" : "View participation details →"}</p>
      </Link>)}
      {!items.length ? <p role="status" className="py-4 text-sm text-slate-600">{loading ? (lang === "ko" ? "불러오는 중…" : "Loading…") : failed ? (lang === "ko" ? "참여 목록을 불러오지 못했습니다." : "Could not load participation items.") : (lang === "ko" ? "현재 진행 중인 항목이 없습니다." : "No activities are currently open.")}</p> : null}
    </div>
    <Link to="/events" className="mt-4 inline-block text-sm font-medium text-brand-primary">{lang === "ko" ? "전체 일정 보기 →" : "View all events →"}</Link>
  </section>;
}
