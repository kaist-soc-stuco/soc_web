import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Search, X } from 'lucide-react';
import { csIrregularCourseCodes, csRequiredCourseCodes, csRoadmapCourses, type RoadmapCourse } from '@/lib/static-site-content';
import { SiteLayout } from '@/components/organisms/site-layout';
const rowLabels: Record<number, string> = {
    1: uiText("pages.roadmap-page.be2caeeefa"),
    2: uiText("pages.roadmap-page.0fddea94cf"),
    3: uiText("pages.roadmap-page.11cb2a7c28"),
    4: uiText("pages.roadmap-page.1ac00f293e"),
    5: uiText("pages.roadmap-page.c3f94adeaf"),
    6: uiText("pages.roadmap-page.8918e40ca3"),
};
const trackLabels = ['전체', '기초/이론', '시스템', 'AI/데이터', '보안/네트워크', 'HCI/그래픽스', '소프트웨어'] as const;
type TrackLabel = (typeof trackLabels)[number];
function cleanRelation(code: string) {
    return code.split(' ')[0];
}
function getTrack(course: RoadmapCourse): Exclude<TrackLabel, '전체'> {
    const text = `${course.code} ${course.name}`;
    if (/보안|전산망|네트워크/.test(text))
        return '보안/네트워크';
    if (/기계학습|딥러닝|인공지능|데이터|데이타|비전|자연언어|그래프/.test(text))
        return 'AI/데이터';
    if (/운영체제|시스템|전산기조직|컴파일러|동시성|모바일/.test(text))
        return '시스템';
    if (/소프트웨어|테스팅|요구공학|서비스/.test(text))
        return '소프트웨어';
    if (/상호작용|그래픽스|소셜/.test(text))
        return 'HCI/그래픽스';
    return '기초/이론';
}
const otlStartCourseIds: Record<string, string> = {
    '101': '744',
    '109': '763',
    '202': '774',
    '204': '745',
    '206': '746',
    '211': '752',
    '220': '764',
    '230': '765',
    '270': '766',
    '300': '747',
    '311': '748',
    '320': '749',
    '330': '750',
    '341': '775',
    '348': '23730',
    '350': '753',
    '360': '754',
    '371': '24212',
    '372': '1303',
    '374': '8289',
    '376': '16194',
    '380': '755',
    '402': '776',
    '411': '24079',
    '420': '1298',
    '422': '1991',
    '431': '23572',
    '442': '768',
    '447': '23891',
    '453': '1973',
    '454': '8343',
    '457': '756',
    '459': '1974',
    '470': '1975',
    '471': '23889',
    '473': '16195',
    '475': '23396',
    '479': '24076',
    '482': '1977',
    '484': '4540',
    '485': '24078',
    '489': '1978',
};
function getRelationMaps() {
    const prereqParents = new Map<string, string[]>();
    const refParents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const course of csRoadmapCourses) {
        const prereqs = (course.prereqs ?? []).map(cleanRelation);
        const refs = (course.refs ?? []).map(cleanRelation);
        prereqParents.set(course.code, prereqs);
        refParents.set(course.code, refs);
        for (const relation of [...prereqs, ...refs]) {
            children.set(relation, [...(children.get(relation) ?? []), course.code]);
        }
    }
    return { prereqParents, refParents, children };
}
export function RoadmapPage() {
    const pageContainerClass = 'mx-auto w-full max-w-[1800px] px-6';
    const headerContainerClass = 'mx-auto max-w-[1800px] px-6';
    const rows = Object.keys(rowLabels).map(Number);
    const [hoverCode, setHoverCode] = useState<string | null>(null);
    const [selectedCode, setSelectedCode] = useState<string | null>(csRoadmapCourses[0]?.code ?? null);
    const [trackFilter, setTrackFilter] = useState<TrackLabel>('전체');
    const [rowFilter, setRowFilter] = useState<number | '전체'>('전체');
    const [searchQuery, setSearchQuery] = useState('');
    const [completedCodes, setCompletedCodes] = useState<Set<string>>(() => new Set());
    useEffect(() => {
        const saved = window.localStorage.getItem('soc-roadmap-completed-courses');
        if (!saved)
            return;
        try {
            setCompletedCodes(new Set(JSON.parse(saved) as string[]));
        }
        catch {
            setCompletedCodes(new Set());
        }
    }, []);
    useEffect(() => {
        window.localStorage.setItem('soc-roadmap-completed-courses', JSON.stringify([...completedCodes]));
    }, [completedCodes]);
    const courseByCode = useMemo(() => new Map(csRoadmapCourses.map((course) => [course.code, course])), []);
    const relationMaps = useMemo(getRelationMaps, []);
    const activeCode = hoverCode ?? selectedCode;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const relationSets = useMemo(() => {
        if (!activeCode) {
            return {
                prereqCodes: new Set<string>(),
                downstreamCodes: new Set<string>(),
                referenceCodes: new Set<string>(),
                highlightedCodes: new Set<string>(),
            };
        }
        const prereqCodes = new Set<string>();
        const downstreamCodes = new Set<string>();
        const referenceCodes = new Set<string>();
        const collectPrereqs = (code: string) => {
            for (const parent of relationMaps.prereqParents.get(code) ?? []) {
                if (prereqCodes.has(parent))
                    continue;
                prereqCodes.add(parent);
                collectPrereqs(parent);
            }
        };
        const collectReferences = (code: string) => {
            for (const parent of relationMaps.refParents.get(code) ?? []) {
                referenceCodes.add(parent);
            }
        };
        const collectChildren = (code: string) => {
            for (const child of relationMaps.children.get(code) ?? []) {
                if (downstreamCodes.has(child))
                    continue;
                downstreamCodes.add(child);
                collectChildren(child);
            }
        };
        collectPrereqs(activeCode);
        collectReferences(activeCode);
        collectChildren(activeCode);
        return {
            prereqCodes,
            downstreamCodes,
            referenceCodes,
            highlightedCodes: new Set([activeCode, ...prereqCodes, ...downstreamCodes, ...referenceCodes]),
        };
    }, [activeCode, relationMaps]);
    const selectedCourse = selectedCode ? courseByCode.get(selectedCode) : undefined;
    const toggleCompleted = (code: string) => {
        setCompletedCodes((current) => {
            const next = new Set(current);
            if (next.has(code)) {
                next.delete(code);
            }
            else {
                next.add(code);
            }
            return next;
        });
    };
    const getStatus = (course: RoadmapCourse) => {
        if (completedCodes.has(course.code))
            return uiText("pages.roadmap-page.8d8680373c");
        const prereqs = (course.prereqs ?? []).map(cleanRelation);
        if (prereqs.length === 0 || prereqs.every((code) => completedCodes.has(code)))
            return uiText("pages.roadmap-page.420ed29575");
        return uiText("pages.roadmap-page.8fa2145834");
    };
    const matchesFilters = (course: RoadmapCourse) => {
        const matchesTrack = trackFilter === '전체' || getTrack(course) === trackFilter;
        const matchesRow = rowFilter === '전체' || course.row === rowFilter;
        const matchesSearch = normalizedQuery.length === 0 ||
            `cs${course.code}`.includes(normalizedQuery) ||
            course.name.toLowerCase().includes(normalizedQuery);
        return matchesTrack && matchesRow && matchesSearch;
    };
    return (<SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
          <div className={headerContainerClass}>
            <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-kaist-white">{uiText("pages.roadmap-page.3113991d60")}</h1>
            <p className="text-[24px] font-semibold tracking-tight text-kaist-white">{uiText("pages.roadmap-page.27e0fb556c")}</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-10`}>
          <div className="mb-6 grid gap-4 rounded-[8px] border border-kaist-grey/20 bg-white p-5 shadow-[0_16px_44px_rgba(57,64,75,0.07)]">
            <label className="flex items-center gap-3 border-b border-kaist-grey/25 pb-4">
              <Search className="h-6 w-6 text-kaist-greygreen"/>
              <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={uiText("pages.roadmap-page.ab26d9da36")} className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tracking-tight text-kaist-black placeholder:text-kaist-greygreen focus:outline-none"/>
            </label>

            <div className="flex flex-wrap gap-2">
              {trackLabels.map((track) => (<button key={track} type="button" onClick={() => setTrackFilter(track)} className={`rounded-full border px-4 py-2 text-[13px] font-extrabold tracking-tight transition ${trackFilter === track
                ? 'border-kaist-darkgreen bg-kaist-darkgreen text-kaist-white'
                : 'border-kaist-grey/25 bg-white text-kaist-black hover:bg-kaist-grey/10'}`}>
                  {track}
                </button>))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRowFilter('전체')} className={`rounded-full border px-4 py-2 text-[13px] font-extrabold tracking-tight transition ${rowFilter === '전체'
            ? 'border-kaist-darkgreen-main bg-kaist-darkgreen-main text-kaist-white'
            : 'border-kaist-grey/25 bg-white text-kaist-black hover:bg-kaist-grey/10'}`}>{uiText("pages.roadmap-page.765be374e9")}</button>
              {rows.map((row) => (<button key={row} type="button" onClick={() => setRowFilter(row)} className={`rounded-full border px-4 py-2 text-[13px] font-extrabold tracking-tight transition ${rowFilter === row
                ? 'border-kaist-darkgreen-main bg-kaist-darkgreen-main text-kaist-white'
                : 'border-kaist-grey/25 bg-white text-kaist-black hover:bg-kaist-grey/10'}`}>
                  {rowLabels[row]}
                </button>))}
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2.5 text-[13px] font-bold tracking-tight">
            <span className="rounded-full border border-kaist-darkgreen bg-white px-3 py-1.5 text-kaist-darkgreen">{uiText("pages.roadmap-page.e9a24d72cc")}</span>
            <span className="rounded-full border border-kaist-grey/25 bg-white px-3 py-1.5 text-kaist-black">{uiText("pages.roadmap-page.d6c80699c8")}</span>
            <span className="rounded-full border border-dashed border-kaist-darkgreen bg-white px-3 py-1.5 text-kaist-darkgreen">{uiText("pages.roadmap-page.7464e4cd55")}</span>
            <span className="rounded-full bg-[#dbeafe] px-3 py-1.5 text-[#1d4ed8]">{uiText("pages.roadmap-page.276d16de31")}</span>
            <span className="rounded-full bg-kaist-lightgreen2/40 px-3 py-1.5 text-kaist-darkgreen">{uiText("pages.roadmap-page.a2ba389967")}</span>
            <span className="rounded-full bg-kaist-grey/10 px-3 py-1.5 text-kaist-grey">{uiText("pages.roadmap-page.5cc060834b")}</span>
          </div>

          <div className="overflow-x-auto rounded-[8px] border border-kaist-grey/20 bg-white p-5 shadow-[0_20px_70px_rgba(57,64,75,0.08)]">
            <div className="min-w-[1320px] space-y-3">
              {rows.map((row) => {
            const courses = csRoadmapCourses.filter((course) => course.row === row);
            return (<div key={row} className="grid grid-cols-[96px_repeat(9,minmax(0,1fr))] gap-2.5">
                    <div className="flex items-center text-[14px] font-extrabold tracking-tight text-kaist-darkgreen">{rowLabels[row]}</div>
                    {Array.from({ length: 9 }, (_, index) => {
                    const column = index + 1;
                    const course = courses.find((item) => item.column === column);
                    if (!course) {
                        return <div key={column} className="min-h-[112px] rounded-[8px] bg-[#F7FCFC]"/>;
                    }
                    const isRequired = csRequiredCourseCodes.includes(course.code);
                    const isIrregular = csIrregularCourseCodes.includes(course.code);
                    const isSelected = selectedCode === course.code;
                    const isActive = activeCode === course.code;
                    const isPrereq = relationSets.prereqCodes.has(course.code);
                    const isDownstream = relationSets.downstreamCodes.has(course.code);
                    const isReference = relationSets.referenceCodes.has(course.code);
                    const isHighlighted = relationSets.highlightedCodes.has(course.code);
                    const isDimmedByRelation = activeCode !== null && !isHighlighted;
                    const isFiltered = matchesFilters(course);
                    const isCompleted = completedCodes.has(course.code);
                    const status = getStatus(course);
                    const relationClass = isActive
                        ? 'border-kaist-darkgreen-main bg-kaist-darkgreen-main text-kaist-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                        : isPrereq
                            ? 'border-[#60a5fa] bg-[#dbeafe] text-[#1e3a8a]'
                            : isDownstream
                                ? 'border-kaist-lightgreen bg-kaist-lightgreen2/40 text-kaist-darkgreen'
                                : isReference
                                    ? 'border-kaist-grey/30 bg-kaist-grey/10 text-kaist-grey'
                                    : isRequired
                                        ? 'border-kaist-darkgreen/60 bg-white text-kaist-black'
                                        : 'border-kaist-grey/25 bg-white text-kaist-black';
                    return (<article key={course.code} onMouseEnter={() => setHoverCode(course.code)} onMouseLeave={() => setHoverCode(null)} className={`relative min-h-[124px] rounded-[8px] border p-3 transition ${relationClass} ${isIrregular && !isActive ? 'border-dashed' : ''} ${isDimmedByRelation || !isFiltered ? 'opacity-30' : 'opacity-100'} ${isSelected ? 'ring-2 ring-kaist-darkgreen-main/35' : ''}`}>
                          <button type="button" onClick={() => setSelectedCode(course.code)} className="block w-full text-left">
                            <p className={`text-[12px] font-extrabold tracking-tight ${isActive ? 'text-kaist-lightgreen2' : 'text-kaist-darkgreen-main'}`}>
                              CS{course.code}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {isRequired ? (<span className="inline-flex rounded-full bg-kaist-darkgreen px-2 py-0.5 text-[10px] font-extrabold text-kaist-white">{uiText("pages.roadmap-page.5b4a45c263")}</span>) : null}
                              {isIrregular ? (<span className="inline-flex rounded-full border border-kaist-darkgreen px-2 py-0.5 text-[10px] font-extrabold text-kaist-darkgreen">{uiText("pages.roadmap-page.e48f3e9f33")}</span>) : null}
                            </div>
                            <h2 className="mt-1 text-[15px] font-extrabold leading-5 tracking-tight">{course.name}</h2>
                            <p className="mt-2 text-[11px] font-bold tracking-tight opacity-80">{getTrack(course)}</p>
                          </button>

                          <button type="button" onClick={(event) => {
                            event.stopPropagation();
                            toggleCompleted(course.code);
                        }} className={`absolute bottom-3 right-3 grid h-6 w-6 place-items-center rounded-full border transition ${isCompleted ? 'border-kaist-darkgreen bg-kaist-darkgreen text-kaist-white' : 'border-kaist-grey/30 bg-white text-transparent'}`} aria-label={uiFormat("pages.roadmap-page.template.76d4eb3fe3", [course.name])}>
                            <Check className="h-3.5 w-3.5" strokeWidth={3}/>
                          </button>

                          <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${status === uiText("pages.roadmap-page.8d8680373c")
                            ? 'bg-kaist-darkgreen text-kaist-white'
                            : status === uiText("pages.roadmap-page.420ed29575")
                                ? 'bg-kaist-lightgreen2/40 text-kaist-darkgreen'
                                : 'bg-kaist-grey/10 text-kaist-grey'}`}>
                            {status}
                          </span>
                        </article>);
                })}
                  </div>);
        })}
            </div>
          </div>

          {selectedCourse ? (<aside className="fixed bottom-6 right-6 z-50 max-h-[calc(100vh-120px)] w-[min(360px,calc(100vw-48px))] overflow-y-auto rounded-[8px] border border-kaist-grey/25 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
              {selectedCourse ? (<>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-extrabold tracking-tight text-kaist-darkgreen-main">CS{selectedCourse.code}</p>
                      <h2 className="mt-2 text-[22px] font-extrabold leading-normal tracking-tight text-kaist-black">{selectedCourse.name}</h2>
                    </div>
                    <button type="button" onClick={() => setSelectedCode(null)} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-kaist-grey/25 text-kaist-grey transition hover:bg-kaist-grey/10" aria-label={uiText("pages.roadmap-page.494bdaa47c")}>
                      <X className="h-4 w-4"/>
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-kaist-lightgreen2/40 px-3 py-1 text-[12px] font-extrabold text-kaist-darkgreen">{getTrack(selectedCourse)}</span>
                    <span className="rounded-full bg-kaist-grey/10 px-3 py-1 text-[12px] font-extrabold text-kaist-grey">{rowLabels[selectedCourse.row]}</span>
                    {csRequiredCourseCodes.includes(selectedCourse.code) ? (<span className="rounded-full bg-kaist-darkgreen px-3 py-1 text-[12px] font-extrabold text-kaist-white">{uiText("pages.roadmap-page.5b4a45c263")}</span>) : null}
                    {csIrregularCourseCodes.includes(selectedCourse.code) ? (<span className="rounded-full border border-dashed border-kaist-darkgreen px-3 py-1 text-[12px] font-extrabold text-kaist-darkgreen">{uiText("pages.roadmap-page.e48f3e9f33")}</span>) : null}
                  </div>

                  <div className="mt-6 space-y-5">
                    <div>
                      <h3 className="text-[14px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.roadmap-page.2b055f36c4")}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selectedCourse.prereqs ?? []).length > 0 ? (selectedCourse.prereqs?.map((code) => (<button key={code} type="button" onClick={() => setSelectedCode(cleanRelation(code))} className="rounded-full bg-[#dbeafe] px-3 py-1 text-[12px] font-bold text-[#1d4ed8]">
                              CS{cleanRelation(code)}
                            </button>))) : (<p className="text-[13px] font-semibold text-kaist-grey">{uiText("pages.roadmap-page.d58fa73adc")}</p>)}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[14px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.roadmap-page.bb9cdf8f71")}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(relationMaps.children.get(selectedCourse.code) ?? []).length > 0 ? (relationMaps.children.get(selectedCourse.code)?.map((code) => (<button key={code} type="button" onClick={() => setSelectedCode(code)} className="rounded-full bg-kaist-lightgreen2/40 px-3 py-1 text-[12px] font-bold text-kaist-darkgreen">
                              CS{code}
                            </button>))) : (<p className="text-[13px] font-semibold text-kaist-grey">{uiText("pages.roadmap-page.d58fa73adc")}</p>)}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[14px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.roadmap-page.5cc060834b")}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selectedCourse.refs ?? []).length > 0 ? (selectedCourse.refs?.map((code) => (<button key={code} type="button" onClick={() => setSelectedCode(cleanRelation(code))} className="rounded-full bg-kaist-grey/10 px-3 py-1 text-[12px] font-bold text-kaist-grey">
                              CS{cleanRelation(code)}
                            </button>))) : (<p className="text-[13px] font-semibold text-kaist-grey">{uiText("pages.roadmap-page.d58fa73adc")}</p>)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 flex flex-col gap-3">
                    <button type="button" onClick={() => toggleCompleted(selectedCourse.code)} className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-kaist-darkgreen px-4 py-2.5 text-[13px] font-extrabold text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white">
                      <Check className="h-4 w-4"/>
                      {completedCodes.has(selectedCourse.code) ? uiText("pages.roadmap-page.8361153d3f") : uiText("pages.roadmap-page.2bfa160158")}
                    </button>
                    <a href={`https://otl.kaist.ac.kr/dictionary?startCourseId=${otlStartCourseIds[selectedCourse.code]}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-kaist-darkgreen px-4 py-2.5 text-[13px] font-extrabold text-kaist-white transition hover:bg-kaist-darkgreen-main">{uiText("pages.roadmap-page.6873c3e084")}<ExternalLink className="h-4 w-4"/>
                    </a>
                  </div>
                </>) : (null)}
            </aside>) : null}

          <p className="mt-5 text-[13px] font-semibold leading-6 tracking-tight text-kaist-grey">{uiText("pages.roadmap-page.c1648df529")}</p>
        </section>
      </div>
    </SiteLayout>);
}
