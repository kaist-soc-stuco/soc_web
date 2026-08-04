import { uiText } from "@/lib/i18n/surface-catalog";
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventItem } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { RelatedContentCards } from '@/components/organisms/related-content-cards';
import { getEvents } from '@/lib/event-api';
import { surveyApi } from '@/lib/survey-api';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
    image?: string;
}
function formatEventDate(event: EventItem, locale: 'ko' | 'en') {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(event.startAtMs));
}
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
    const pageContainerClass = 'mx-auto w-full px-4 sm:px-[12vw]';
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
            date: formatEventDate(event, locale),
            status: event.startAtMs > Date.now() ? 'upcoming' : event.endAtMs > Date.now() ? 'ongoing' : 'completed',
            href: event.surveyId ? `/events/${encodeURIComponent(event.id)}/survey` : `/calendar?eventId=${encodeURIComponent(event.id)}`,
        }))
        : surveys.map((survey) => ({
            id: survey.id,
            title: localizedText(survey.title, locale),
            summary: survey.description ? localizedText(survey.description, locale) : '',
            titleTranslationUnavailable: survey.title.translationUnavailable,
            summaryTranslationUnavailable: Boolean(survey.description?.translationUnavailable),
            date: survey.closesAt ? new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(survey.closesAt)) : '',
            status: survey.state === 'OPEN' ? 'ongoing' : 'upcoming',
            href: `/survey/${encodeURIComponent(survey.id)}`,
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
        const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
        const endPage = Math.min(totalPages, startPage + 4);
        for (let i = startPage; i <= endPage; i += 1) {
            pages.push(i);
        }
        return pages;
    };
    return (<SiteLayout>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
        <div className={pageContainerClass}>
          <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-white">{uiText("pages.events-page.e91f6f515d")}</h1>
          <p className="text-[20px] font-semibold tracking-tight text-white">{uiText("pages.events-page.5576156632")}</p>
        </div>
      </div>

      <div className="border-b border-kaist-grey/30 bg-[#F7FCFC]">
          <div className={`${pageContainerClass} flex flex-col gap-3 py-2 sm:flex-row sm:items-end sm:justify-between`}>
          <div className="flex flex-wrap items-stretch gap-2 sm:gap-8 lg:gap-10">
            {eventTabs.map((tab, index) => (<Link key={tab.id} to={{ search: `?type=${tab.id}` }} className="group relative min-h-11" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} aria-current={activeTab === tab.id ? 'page' : undefined}>
                <span className={`relative flex h-full items-center justify-center text-lg font-extrabold tracking-tight transition-colors ${activeTab === tab.id ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                  <span className="py-3">{tab.label()}</span>
                  <span className={`absolute bottom-0 left-0 right-0 h-1.5 origin-center bg-kaist-darkgreen transition-transform duration-200 ${activeTab === tab.id ? 'scale-x-150' : hoveredIndex === index ? 'scale-x-150' : 'scale-x-0'}`}/>
                </span>
              </Link>))}
          </div>

          <div className="flex min-h-11 items-center gap-2 border-b border-kaist-darkgreen/40">
            <span className="text-base font-semibold text-[#9AA69F]">{uiText("pages.events-page.078b3a1b0a")}</span>
            <span className="text-base text-kaist-darkgreen">⌄</span>
            <input type="text" value={searchQuery} onChange={(event) => handleSearchChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" aria-label={uiText("pages.events-page.b8306f829b")}/>
            <Search className="h-4 w-4 shrink-0 text-kaist-darkgreen"/>
          </div>
        </div>
        </div>

      <section className={`${pageContainerClass} bg-[#F7FCFC] pb-16 pt-8`}>
        <div className="grid grid-cols-[minmax(0,270px)] justify-center gap-x-6 gap-y-[51px] min-[1900px]:justify-between sm:grid-cols-[repeat(auto-fit,270px)]">
          {canRenderCards && currentEvents.map((event) => (<div key={event.id} className="w-full max-w-[270px]">
              <Link to={event.href} className="group flex h-[359px] w-full min-w-0 flex-col overflow-hidden rounded-lg bg-kaist-white shadow-[-1px_0_4px_rgba(0,0,0,0.22),1px_2px_4px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="relative h-[60.2%] min-h-[168px] flex-shrink-0 overflow-hidden rounded-t-md bg-kaist-greygreen/20">
                {event.image ? (<div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${event.image})` }}/>) : null}
                <span className="absolute left-4 top-4 rounded-full bg-kaist-darkgreen px-3 py-1 text-[10px] font-semibold tracking-tight text-kaist-white lg:text-xs">
                  {event.status === 'upcoming' ? uiText("pages.events-page.7ba9542c96") : event.status === 'ongoing' ? uiText("pages.events-page.0dae9079ff") : uiText("pages.events-page.8d8680373c")}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
                <span className="mb-1 text-[10px] font-bold tracking-tight text-[#5b93c4] lg:text-xs">{uiText("pages.events-page.bff20dc3bb")}</span>
                <h2 className="line-clamp-2 text-lg font-extrabold tracking-tight text-kaist-black lg:text-2xl">
                  {event.title}
                </h2>
                {(event.titleTranslationUnavailable || event.summaryTranslationUnavailable) && <p className="text-xs text-kaist-grey">{locale === 'ko' ? '일부 번역이 제공되지 않습니다.' : 'Some translations are unavailable.'}</p>}
                <p className="mt-2 line-clamp-2 text-xs font-semibold leading-normal tracking-tight text-kaist-grey">
                  {event.summary}
                </p>
                <div className="mt-auto flex items-center gap-2 text-[10px] font-semibold tracking-tight text-kaist-greygreen lg:text-xs">
                  <CalendarDays className="h-3.5 w-3.5"/>
                  {event.date}
                </div>
              </div>
              </Link>
              <RelatedContentCards subject={activeTab === 'event' ? { eventId: String(event.id) } : { surveyId: String(event.id) }} locale={locale}/>
            </div>))}
        </div>

        {eventIsLoading || surveyIsLoading ? (<div className="py-20 text-center text-kaist-grey" role="status"><p className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.loadingEvent") : uiText("surface.events.loadingSurvey")}</p></div>) : eventHasError || surveyHasError ? (<div className="py-20 text-center text-kaist-grey"><p role="alert" className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.errorEvent") : uiText("surface.events.errorSurvey")}</p><button ref={retryButtonRef} type="button" className="mt-4 min-h-11 px-2 underline" onClick={() => setReloadToken((value) => value + 1)}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></div>) : currentEvents.length === 0 ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{activeTab === 'event' ? uiText("surface.events.emptyEvent") : uiText("surface.events.emptySurvey")}</p></div>) : null}

        <div className="mt-8 flex items-center justify-center gap-2 text-[12px] font-medium tracking-tight text-kaist-black">
          <button type="button" onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`p-1 transition-colors ${currentPage === 1 ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`} aria-label={uiText("pages.events-page.b5f6e8aed4")}>
            <ChevronLeft className="h-5 w-5"/>
          </button>

          {getPageNumbers().map((page) => (<button key={page} type="button" onClick={() => handlePageChange(page)} className={`h-[28px] min-w-[28px] rounded-[5px] px-2 transition-colors ${currentPage === page ? 'bg-kaist-darkgreen-main text-kaist-white' : 'text-kaist-black hover:bg-kaist-grey/10'}`}>
              {page}
            </button>))}

          <button type="button" onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`p-2 transition-colors ${currentPage === totalPages ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`} aria-label={uiText("pages.events-page.b2aa104e6e")}>
            <ChevronRight className="h-5 w-5"/>
          </button>
        </div>
      </section>
    </SiteLayout>);
}
