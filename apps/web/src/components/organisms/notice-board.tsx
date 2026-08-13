import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArticleSummary, Board } from '@soc/contracts';
import { boardApi } from '@/lib/board-api';
import { useLocale } from '@/lib/locale-store';
type HomeBoard = Board & {
    latestArticles?: ArticleSummary[];
};
type LoadState = 'loading' | 'ready' | 'error';
export function NoticeBoard() {
    const [locale] = useLocale();
    const [boards, setBoards] = useState<HomeBoard[]>([]);
    const [activeCode, setActiveCode] = useState<string | null>(null);
    const [status, setStatus] = useState<LoadState>('loading');
    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        boardApi.list({ home: true, latestLimit: 5, locale }, controller.signal)
            .then(({ items }) => {
            setBoards(items);
            setActiveCode((current) => items.some((item) => item.code === current) ? current : items[0]?.code ?? null);
            setStatus('ready');
        })
            .catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === 'AbortError'))
                setStatus('error');
        });
        return () => controller.abort();
    }, [locale]);
    const selected = boards.find((item) => item.code === activeCode) ?? boards[0] ?? null;
    const articles = selected?.latestArticles ?? [];
    return (<section className="flex h-full min-h-0 flex-col bg-kaist-white lg:pr-9" aria-label={uiText("components.organisms.notice-board.4303086e18")}>
      {status === 'ready' && boards.length > 0 ? (<>
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b-2 border-kaist-grey/30 pl-1">
            <div className="flex flex-wrap items-stretch gap-3 lg:gap-5">
              {boards.map((board) => (<button key={board.code} type="button" onClick={() => setActiveCode(board.code)} className={`border-b-4 px-1 py-1.5 text-base lg:text-lg font-bold tracking-tight transition-colors ${selected?.code === board.code ? 'border-kaist-darkgreen text-kaist-darkgreen' : 'border-transparent text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                  {board.title.value}
                </button>))}
            </div>
            {selected ? (<Link to={`/board/${encodeURIComponent(selected.code)}`} className="shrink-0 px-1 pb-1.5 pt-1 text-sm lg:text-lg lg:pt-2 font-bold tracking-tight text-kaist-greygreen transition-colors hover:text-kaist-darkgreen" aria-label={uiText("components.organisms.notice-board.4748261af6")}>
              +
            </Link>) : null}
          </div>
          {selected && (<div className="flex flex-1 flex-col pb-4">
              {articles.length > 0 ? (<ul className="divide-y divide-kaist-grey/20">
                  {articles.map((article) => (<li key={article.id}>
                      <Link to={`/board/${encodeURIComponent(article.boardCode)}/${encodeURIComponent(article.id)}`} className="flex items-center justify-between gap-4 py-3 hover:text-kaist-darkgreen">
                        <span className="min-w-0 truncate text-sm font-bold">{article.isPinned && <span className="mr-2 text-kaist-darkgreen">{uiText("components.organisms.notice-board.4f48c00403")}</span>}{article.title.value ?? uiText("components.organisms.notice-board.fd823ad161")}</span>
                        <time className="shrink-0 text-xs font-semibold text-kaist-grey" dateTime={article.publishedAt ?? article.updatedAt}>{new Date(article.publishedAt ?? article.updatedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</time>
                      </Link>
                    </li>))}
                </ul>) : <p className="py-6 text-sm font-semibold text-kaist-grey">{uiText("components.organisms.notice-board.8cf358d8d8")}</p>}
            </div>)}
        </>) : status === 'error' ? (<p role="alert" className="py-8 text-sm font-semibold text-red-700">{uiText("components.organisms.notice-board.9f4895d2f8")}</p>) : status === 'ready' ? (<p className="py-8 text-sm font-semibold text-kaist-grey">{uiText("components.organisms.notice-board.ae15cd0533")}</p>) : (<p role="status" className="py-8 text-sm font-semibold text-kaist-grey">{uiText("components.organisms.notice-board.82a2f0865b")}</p>)}
    </section>);
}
