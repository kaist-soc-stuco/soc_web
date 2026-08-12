import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { SiteLayout } from '@/components/organisms/site-layout';
import { boardApi } from '@/lib/board-api';
import { useLocale } from '@/lib/locale-store';
import type { Board, EventItem, SurveyDto } from '@soc/contracts';
import { useAuthSession } from '@/lib/auth-session';
import { useAdminGrants } from '@/lib/admin-grants';
import { canCreateBoardArticle } from '@/lib/board-capabilities';
import { adminEventApi } from '@/lib/admin-event-api';
import { surveyApi } from '@/lib/survey-api';
export function BoardWritePage() {
    const [locale] = useLocale();
    const auth = useAuthSession();
    const grants = useAdminGrants();
    const { category = 'soc-notice' } = useParams<{
        category: string;
    }>();
    const navigate = useNavigate();
    const bilingual = grants.status === 'ready' && grants.grants.some((grant) => grant.permission === 'BOARD_MANAGE' && grant.scope === 'GLOBAL');
    const [boardTitle, setBoardTitle] = useState(category);
    const [boardDescription, setBoardDescription] = useState('');
    const [titleKr, setTitleKr] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [bodyKr, setBodyKr] = useState('');
    const [bodyEn, setBodyEn] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [surveys, setSurveys] = useState<SurveyDto[]>([]);
    const [eventId, setEventId] = useState('');
    const [surveyId, setSurveyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);
    const [boardReady, setBoardReady] = useState(false);
    const [board, setBoard] = useState<Board | null>(null);
    const canCreate = canCreateBoardArticle(board, auth, grants.grants);
    const capabilityLoading = auth.status !== 'ready' || grants.status === 'idle' || grants.status === 'loading';
    useEffect(() => {
        const controller = new AbortController();
        const activeRequest = ++requestId.current;
        setLoading(true);
        setBoardReady(false);
        setBoard(null);
        setError(null);
        setBoardTitle(category);
        setBoardDescription('');
        boardApi.get(category, locale, controller.signal)
            .then(({ board }) => {
            if (activeRequest !== requestId.current)
                return;
            setBoardTitle(board.title.value ?? '');
            setBoardDescription(board.description.value ?? '');
            setBoardReady(true);
            setBoard(board);
        })
            .catch((cause: unknown) => {
            if (activeRequest === requestId.current && (cause as {
                name?: string;
            }).name !== 'AbortError')
                setError(uiText("pages.board-write-page.88812f5baa"));
        })
            .finally(() => {
            if (activeRequest === requestId.current)
                setLoading(false);
        });
        return () => controller.abort();
    }, [category, locale]);
    useEffect(() => {
        if (!bilingual) {
            setEvents([]);
            setSurveys([]);
            setEventId('');
            setSurveyId('');
            return;
        }
        const controller = new AbortController();
        Promise.all([adminEventApi.list(), surveyApi.listAdmin(controller.signal)])
            .then(([eventList, surveyList]) => {
            setEvents(eventList.items);
            setSurveys(surveyList.items);
        })
            .catch(() => setError(uiText("pages.board-write-page.4d698d9f9c")));
        return () => controller.abort();
    }, [bilingual]);
    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!boardReady || !canCreate)
            return;
        const values = bilingual
            ? { titleKr: titleKr.trim(), titleEn: titleEn.trim(), bodyKr: bodyKr.trim(), bodyEn: bodyEn.trim() }
            : { title: titleKr.trim(), body: bodyKr.trim() };
        if (Object.values(values).some((value) => !value)) {
            setError(bilingual ? uiText("pages.board-write-page.52b8f0aef1") : uiText("pages.board-write-page.e57682c81e"));
            return;
        }
        setPending(true);
        setError(null);
        try {
            const draft = await boardApi.createDraft(category, {
                ...values,
                scope: 'ALL',
            });
            if (attachment) {
                const initiated = await boardApi.initiateAsset(draft.id, {
                    displayOrder: 0,
                    type: 'ATTACHMENT',
                    contentType: attachment.type || 'application/octet-stream',
                    byteSize: attachment.size,
                });
                await boardApi.uploadAsset(initiated.uploadUrl, initiated.uploadHeaders, attachment);
                await boardApi.completeAsset(initiated.asset.id);
            }
            if (eventId) {
                await surveyApi.createRelation({ articleId: draft.id, eventId, relationType: 'SCHEDULE', syncMode: 'NONE' });
            }
            if (surveyId) {
                await surveyApi.createRelation({ articleId: draft.id, surveyId, relationType: 'ANNOUNCEMENT', syncMode: 'NONE' });
            }
            const published = await boardApi.publish(draft.id);
            navigate(`/board/${category}/${published.id}`);
        }
        catch {
            setError(uiText("pages.board-write-page.42a73a935e"));
        }
        finally {
            setPending(false);
        }
    };
    const pageContainerClass = 'mx-auto w-full max-w-[1600px] px-6';
    return (<SiteLayout>
      <div className="min-h-[calc(100vh-4.5rem)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7"><div className={pageContainerClass}>
          <h1 className="mb-2 text-[36px] font-extrabold tracking-tight text-white">{boardTitle}{uiText("pages.board-write-page.2a0a7f3922")}</h1>
          {boardDescription && <p className="text-[24px] font-semibold tracking-tight text-white">{boardDescription}</p>}
        </div></div>
        <section className={`${pageContainerClass} pb-16 pt-8`}>
          <div className="border-b-2 border-kaist-darkgreen-main pb-4"><h2 className="text-xl font-extrabold tracking-tight text-kaist-black">{uiText("pages.board-write-page.d22b8577c3")}</h2><p className="mt-2 text-sm font-semibold tracking-tight text-kaist-grey">{boardTitle}{uiText("pages.board-write-page.49f9a5ed3f")}</p></div>
          {loading || capabilityLoading ? <p className="py-12 text-center text-kaist-grey">{uiText("pages.board-write-page.3848b6aec2")}</p> : !boardReady ? <p role="alert" className="py-12 text-center text-kaist-grey">{error ?? uiText("pages.board-write-page.88812f5baa")}</p> : !canCreate ? <div role="alert" className="py-12 text-center text-kaist-grey"><p>{uiText("pages.board-write-page.e091646008")}</p><Link to={`/board/${category}`} className="mt-4 inline-block font-bold text-kaist-darkgreen underline">{uiText("pages.board-write-page.884734e767")}</Link></div> : <form onSubmit={submit}>
            <div className={`grid gap-8 py-8 ${bilingual ? 'lg:grid-cols-2' : ''}`}>
              <fieldset className="grid gap-5"><legend className="mb-3 text-lg font-extrabold text-kaist-darkgreen">{bilingual ? uiText("pages.board-write-page.6e081b5948") : uiText("pages.board-write-page.847c8582b6")}</legend>
                <label className="grid gap-3 border-b border-kaist-grey/25 pb-5"><span className="text-sm font-extrabold">{uiText("pages.board-write-page.078b3a1b0a")}</span><input required value={titleKr} onChange={(event) => setTitleKr(event.target.value)} type="text" className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"/></label>
                <label className="grid gap-3 border-b border-kaist-grey/25 pb-5"><span className="text-sm font-extrabold">{uiText("pages.board-write-page.c67b871882")}</span><textarea required value={bodyKr} onChange={(event) => setBodyKr(event.target.value)} rows={12} className="min-h-[280px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4 text-sm outline-none transition focus:border-kaist-darkgreen"/></label>
              </fieldset>
              {bilingual ? <fieldset className="grid gap-5"><legend className="mb-3 text-lg font-extrabold text-kaist-darkgreen">English</legend>
                <label className="grid gap-3 border-b border-kaist-grey/25 pb-5"><span className="text-sm font-extrabold">Title</span><input required value={titleEn} onChange={(event) => setTitleEn(event.target.value)} type="text" className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"/></label>
                <label className="grid gap-3 border-b border-kaist-grey/25 pb-5"><span className="text-sm font-extrabold">Body</span><textarea required value={bodyEn} onChange={(event) => setBodyEn(event.target.value)} rows={12} className="min-h-[280px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4 text-sm outline-none transition focus:border-kaist-darkgreen"/></label>
              </fieldset> : null}
            </div>
            <label className="mb-6 grid gap-2 border-b border-kaist-grey/25 pb-5"><span className="text-sm font-extrabold text-kaist-darkgreen">{uiText("pages.board-write-page.6eeb520855")}</span><input aria-label={uiText("pages.board-write-page.c21935b067")} type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}/></label>
            {bilingual ? <div className="mb-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-extrabold text-kaist-darkgreen">{uiText("pages.board-write-page.25ad965096")}<select aria-label={uiText("pages.board-write-page.871ea2ad09")} value={eventId} onChange={(event) => setEventId(event.target.value)} className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 font-normal text-kaist-black"><option value="">{uiText("pages.board-write-page.b894db774d")}</option>{events.map((item) => <option key={item.id} value={item.id}>{item.title.value ?? item.id}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-extrabold text-kaist-darkgreen">{uiText("pages.board-write-page.25bc0b519e")}<select aria-label={uiText("pages.board-write-page.2f5ae22c03")} value={surveyId} onChange={(event) => setSurveyId(event.target.value)} className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 font-normal text-kaist-black"><option value="">{uiText("pages.board-write-page.b894db774d")}</option>{surveys.map((item) => <option key={item.id} value={item.id}>{item.title.value ?? item.id}</option>)}</select></label>
            </div> : null}
            {error && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-kaist-grey/20 pt-6"><Link to={`/board/${category}`} className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen">{uiText("pages.board-write-page.19b2d19bc1")}</Link><button disabled={pending || !boardReady} type="submit" className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-2 text-sm font-extrabold tracking-tight text-white disabled:opacity-50">{pending ? uiText("pages.board-write-page.9ace4cd899") : uiText("pages.board-write-page.8c04ab8884")}</button></div>
          </form>}
        </section>
      </div>
    </SiteLayout>);
}
