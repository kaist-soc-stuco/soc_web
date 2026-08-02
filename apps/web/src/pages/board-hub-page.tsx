import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BoardListResponse } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { boardApi } from '@/lib/board-api';
import { localizedText } from '@/lib/localized-content';
import { useLocale } from '@/lib/locale-store';
export function BoardHubPage() {
    const [locale] = useLocale();
    const [boards, setBoards] = useState<BoardListResponse['items']>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError(false);
        boardApi.list({ locale, home: true, latestLimit: 1 }, controller.signal)
            .then(({ items }) => { if (active)
            setBoards(items.filter((board) => !board.config.isHidden)); })
            .catch((cause: unknown) => {
            if (active && !(cause instanceof DOMException && cause.name === 'AbortError'))
                setError(true);
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; controller.abort(); };
    }, [locale]);
    return <SiteLayout><main className="mx-auto min-h-[calc(100vh-4.5rem)] w-full bg-[#F7FCFC] px-[12vw] py-10">
    <div className="mb-8 flex items-center justify-between gap-4"><h1 className="text-3xl font-extrabold text-kaist-darkgreen">{locale === 'ko' ? uiText("pages.board-hub-page.bd1011dee4") : 'Boards'}</h1></div>
    {loading ? <p>{locale === 'ko' ? uiText("pages.board-hub-page.7c8f6585ab") : 'Loading boards.'}</p> : error ? <p role="alert">{locale === 'ko' ? uiText("pages.board-hub-page.478d00882a") : 'Boards are unavailable.'}</p> : boards.length === 0 ? <p>{locale === 'ko' ? uiText("pages.board-hub-page.491c2f6c70") : 'No boards are available.'}</p> : <div className="grid gap-6 lg:grid-cols-2">{boards.map((board) => <section key={board.id} className="rounded-lg border border-kaist-grey/20 bg-white p-6 shadow-sm"><Link to={`/board/${board.code}`} className="text-xl font-extrabold text-kaist-darkgreen hover:underline">{localizedText(board.title)}</Link><p className="mt-2 text-sm text-kaist-grey">{localizedText(board.description)}</p><h2 className="mt-5 border-b pb-2 font-bold">{locale === 'ko' ? uiText("pages.board-hub-page.760ac028ce") : 'Latest articles'}</h2><ul className="mt-2 grid gap-2">{board.latestArticles?.length ? board.latestArticles.map((article) => <li key={article.id}><Link className="hover:underline" to={`/board/${board.code}/${article.id}`}>{localizedText(article.title)}</Link></li>) : <li className="text-sm text-kaist-grey">{locale === 'ko' ? uiText("pages.board-hub-page.6c484281b4") : 'No articles yet.'}</li>}</ul></section>)}</div>}
  </main></SiteLayout>;
}
