import { uiText } from "@/lib/i18n/surface-catalog";
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventItem } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
// import { RelatedContentCards } from '@/components/organisms/related-content-cards';
import { getEvents } from '@/lib/event-api';
import { formatScheduleDate } from '@/lib/schedule-date';
import { surveyApi } from '@/lib/survey-api';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Search } from 'lucide-react';
import { useLocale } from '@/lib/locale-store';
const localizedText = (content: EventItem['title'], locale: 'ko' | 'en') => content.value ?? (locale === 'ko' ? '번역이 제공되지 않습니다.' : 'Translation unavailable.');
const eventTabs = [{ id: 'survey', label: () => uiText("pages.events-page.e91f6f515d") }, { id: 'event', label: () => uiText("pages.events-page.a6e55f8c8f") }] as const;
const EVENT_WINDOW_MS = 92 * 24 * 60 * 60 * 1000;
type EventTab = (typeof eventTabs)[number]['id'];
interface EventCard {
    id: string | number;
    title: string;
    summary: string;
    titleTranslationUnavailable: boolean;
    summaryTranslationUnavailable: boolean;
    date: string;
    status: 'upcoming' | 'ongoing' | 'completed';
    href: string;
    image: string | null;
    kind: EventTab;
}
const DEFAULT_EVENT_IMAGE = '/hero_background2.webp';
export function EventsPage() {
    const [locale] = useLocale();
    const [searchParams] = useSearchParams();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [eventLoadState, setEventLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [surveys, setSurveys] = useState<Awaited<ReturnType<typeof surveyApi.list>>['items']>([]);
    const [surveyLoadState, setSurveyLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [reloadToken, setReloadToken] = useState(0);
    const pageContainerClass = 'mx-auto max-w-[1600px]';
    const activeTab: EventTab = searchParams.get('type') === 'event' ? 'event' : 'survey';
    const retryButtonRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (activeTab !== 'event') {
            setEventLoadState('idle');
            return;
        }
        const now = Date.now();
        const fromMs = now - EVENT_WINDOW_MS / 2;
        const toMs = now + EVENT_WINDOW_MS / 2;
        const controller = new AbortController();
        setEvents([]);
        setEventLoadState('loading');
        getEvents(fromMs, toMs, locale, controller.signal)
            .then((response) => {
            if (!controller.signal.aborted) {
                setEvents(response.items);
                setEventLoadState('ready');
            }
        })
            .catch(() => {
            if (!controller.signal.aborted)
                setEventLoadState('error');
        });
        return () => controller.abort();
    }, [activeTab, locale, reloadToken]);
    useEffect(() => {
        if (activeTab !== 'survey') {
            setSurveyLoadState('idle');
            return;
        }
        const controller = new AbortController();
        setSurveys([]);
        setSurveyLoadState('loading');
        surveyApi.list(controller.signal, locale).then((response) => {
            if (!controller.signal.aborted) {
                setSurveys(response.items.filter((survey) => survey.state === 'OPEN' || survey.state === 'SCHEDULED'));
                setSurveyLoadState('ready');
            }
        }).catch(() => {
            if (!controller.signal.aborted)
                setSurveyLoadState('error');
        });
        return () => controller.abort();
    }, [activeTab, locale, reloadToken]);
    const cardEvents = useMemo<EventCard[]>(() => activeTab === 'event'
        ? events.map((event) => ({
            id: event.id,
            title: localizedText(event.title, locale),
            summary: localizedText(event.description, locale),
            titleTranslationUnavailable: event.title.translationUnavailable,
            summaryTranslationUnavailable: event.description.translationUnavailable,
            date: formatScheduleDate(event.startAtMs),
            status: event.startAtMs > Date.now() ? 'upcoming' : event.endAtMs > Date.now() ? 'ongoing' : 'completed',
            href: event.surveyId ? `/events/${encodeURIComponent(event.id)}/survey` : `/calendar?eventId=${encodeURIComponent(event.id)}`,
            image: DEFAULT_EVENT_IMAGE,
            kind: 'event',
        }))
        : surveys.map((survey) => ({
            id: survey.id,
            title: localizedText(survey.title, locale),
            summary: survey.description ? localizedText(survey.description, locale) : '',
            titleTranslationUnavailable: survey.title.translationUnavailable,
            summaryTranslationUnavailable: Boolean(survey.description?.translationUnavailable),
            date: survey.closesAt ? formatScheduleDate(survey.closesAt) : '',
            status: survey.state === 'OPEN' ? 'ongoing' : 'upcoming',
            href: `/survey/${encodeURIComponent(survey.id)}`,
            image: null,
            kind: 'survey',
        })), [activeTab, events, surveys, locale]);
    const filteredEvents = cardEvents.filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const cardsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(filteredEvents.length / cardsPerPage));
    const currentEvents = filteredEvents.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
    const eventIsLoading = activeTab === 'event' && (eventLoadState === 'idle' || eventLoadState === 'loading');
    const eventHasError = activeTab === 'event' && eventLoadState === 'error';
    const surveyIsLoading = activeTab === 'survey' && (surveyLoadState === 'idle' || surveyLoadState === 'loading');
    const surveyHasError = activeTab === 'survey' && surveyLoadState === 'error';
    useEffect(() => {
        if (eventHasError || surveyHasError)
            requestAnimationFrame(() => retryButtonRef.current?.focus());
    }, [eventHasError, surveyHasError]);
    const canRenderCards = activeTab === 'event' ? eventLoadState === 'ready' : surveyLoadState === 'ready';
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);
    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const getPageNumbers = () => {
        const pages = [];
        const pageGroupSize = 10;
        const startPage = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1;
        const endPage = Math.min(totalPages, startPage + pageGroupSize - 1);
        for (let i = startPage; i <= endPage; i += 1) {
            pages.push(i);
        }
        return pages;
    };
    return (<SiteLayout>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
        <div className={pageContainerClass}>
          <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-white">{activeTab === 'event' ? (locale === 'ko' ? '행사' : 'Events') : (locale === 'ko' ? '설문조사' : 'Surveys')}</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">{uiText("pages.events-page.5576156632")}</p>
        </div>
      </div>

      <div className="border-b border-kaist-grey/30 bg-[#F7FCFC]">
          <div className={`${pageContainerClass} flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}>
          <div className="flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-12">
            {eventTabs.map((tab, index) => (<Link key={tab.id} to={{ search: `?type=${tab.id}` }} className="group relative min-h-11" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} aria-current={activeTab === tab.id ? 'page' : undefined}>
                <span className={`relative flex h-full items-center justify-center text-[20px] font-bold tracking-tight transition-colors ${activeTab === tab.id ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                  <span className="py-3.5">{tab.label()}</span>
                  <span className={`absolute bottom-0 left-0 right-0 h-1 origin-center bg-kaist-darkgreen transition-transform duration-200 ${activeTab === tab.id ? 'scale-x-100' : hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`}/>
                </span>
              </Link>))}
          </div>

          <label className="mb-4 flex min-h-11 min-w-0 items-center gap-2 border-b border-kaist-darkgreen/40 pt-2 sm:min-w-[320px]">
            <span className="text-[16px] font-semibold text-[#9AA69F]">{uiText("pages.events-page.078b3a1b0a")}</span>
            <span className="text-base mb-2 text-kaist-darkgreen">⌄</span>
            <input type="search" value={searchQuery} onChange={(event) => handleSearchChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-kaist-grey/60" placeholder={activeTab === 'event' ? (locale === 'ko' ? '행사 제목 검색' : 'Search events') : (locale === 'ko' ? '설문 제목 검색' : 'Search surveys')} aria-label={activeTab === 'event' ? (locale === 'ko' ? '행사 제목 검색' : 'Search events') : (locale === 'ko' ? '설문 제목 검색' : 'Search surveys')}/>
            <Search className="h-4 w-4 shrink-0 text-kaist-darkgreen"/>
          </label>
        </div>
        </div>

      <section className="bg-[#F7FCFC] pb-5 pt-12">
        <div className={`${pageContainerClass} flex h-[min(calc(100svh-420px))] min-h-[390px] flex-col`}>
        <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-2 gap-x-3 gap-y-3 sm:gap-x-4 lg:gap-x-5 lg:gap-y-4 xl:gap-x-7 xl:gap-y-7">
          {canRenderCards && currentEvents.map((event) => (<div key={event.id} className="min-w-0">
              <Link to={event.href} className="group flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-kaist-grey/10 bg-white shadow-[-1px_0px_4px_rgba(0,0,0,0.16),1px_2px_4px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen focus:ring-offset-2">
              <div className="relative h-3/5 min-h-[108px] shrink-0 overflow-hidden bg-[linear-gradient(135deg,#146D4A_0%,#6EAF8F_58%,#C9ECC2_100%)]">
                {event.image ? (<img src={event.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>) : (<div className="absolute inset-0 grid place-items-center" aria-hidden="true"><div className="rounded-3xl border border-white/25 bg-white/15 p-6 text-white shadow-sm backdrop-blur-sm"><ClipboardList className="h-12 w-12"/></div></div>)}
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5"/>
                <span className="absolute left-2.5 top-2.5 rounded-full bg-kaist-darkgreen px-2 py-0.5 text-[10px] font-semibold text-white">
                  {event.status === 'upcoming' ? uiText("pages.events-page.7ba9542c96") : event.status === 'ongoing' ? uiText("pages.events-page.0dae9079ff") : uiText("pages.events-page.8d8680373c")}
                </span>
                <span className="absolute bottom-2.5 left-2.5 rounded-[4px] bg-[#5B93C4] px-1.5 py-0.5 text-[8px] font-semibold text-white">KAIST SoC</span>
                {event.date ? <span className="absolute bottom-2.5 right-2.5 rounded-[4px] bg-white/85 px-1.5 py-0.5 text-[8px] font-semibold text-kaist-black">{event.date}</span> : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-2.5 py-2 sm:px-3 xl:px-3.5 xl:pb-2.5 xl:pt-2">
                <p className="text-[10px] font-semibold tracking-tight text-[#5B93C4]">{event.kind === 'event' ? (locale === 'ko' ? '행사' : 'Event') : (locale === 'ko' ? '설문조사' : 'Survey')}</p>
                <h2 className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-[15px] font-extrabold leading-[18px] tracking-tight text-kaist-black xl:text-[16px] xl:leading-[19px]">
                  {event.title}
                </h2>
                {(event.titleTranslationUnavailable || event.summaryTranslationUnavailable) && <p className="text-xs text-kaist-grey">{locale === 'ko' ? '일부 번역이 제공되지 않습니다.' : 'Some translations are unavailable.'}</p>}
                <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-[10px] font-semibold leading-4 text-kaist-grey xl:text-[11px]">
                  {event.summary}
                </p>
                <div className="mt-auto flex items-center gap-1 text-[8px] font-semibold text-[#9AA69F]">
                  <CalendarDays className="h-3 w-3"/>
                  {event.kind === 'survey' && event.date ? (locale === 'ko' ? `마감 ${event.date}` : `Closes ${event.date}`) : event.date}
                </div>
              </div>
              </Link>
              {/* <RelatedContentCards subject={activeTab === 'event' ? { eventId: String(event.id) } : { surveyId: String(event.id) }} locale={locale}/> */}
            </div>))}
        </div>

        {eventIsLoading || surveyIsLoading ? (<div className="py-20 text-center text-kaist-grey" role="status"><p className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.loadingEvent") : uiText("surface.events.loadingSurvey")}</p></div>) : eventHasError || surveyHasError ? (<div className="py-20 text-center text-kaist-grey"><p role="alert" className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.errorEvent") : uiText("surface.events.errorSurvey")}</p><button ref={retryButtonRef} type="button" className="mt-4 min-h-11 px-2 underline" onClick={() => setReloadToken((value) => value + 1)}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></div>) : currentEvents.length === 0 ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.emptyEvent") : uiText("surface.events.emptySurvey")}</p></div>) : null}

        {canRenderCards && currentEvents.length > 0 && totalPages > 1 ? <nav aria-label={locale === 'ko' ? '페이지 이동' : 'Pagination'} className="mt-12 flex shrink-0 items-center justify-center gap-2 text-[18px] font-semibold tracking-tight text-kaist-black">
          <button type="button" onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`p-1 transition-colors ${currentPage === 1 ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`} aria-label={uiText("pages.events-page.b5f6e8aed4")}>
            <ChevronLeft className="h-5 w-5"/>
          </button>

          {getPageNumbers().map((page) => (<button key={page} type="button" onClick={() => handlePageChange(page)} className={`h-[33px] min-w-[33px] rounded-[5px] px-3 transition-colors ${currentPage === page ? 'bg-kaist-darkgreen-main text-kaist-white' : 'text-kaist-black hover:bg-kaist-grey/10'}`}>
              {page}
            </button>))}

          <button type="button" onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`p-2 transition-colors ${currentPage === totalPages ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`} aria-label={uiText("pages.events-page.b2aa104e6e")}>
            <ChevronRight className="h-5 w-5"/>
          </button>
        </nav> : null}
        </div>
      </section>
    </SiteLayout>);
}
