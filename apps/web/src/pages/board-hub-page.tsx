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
        boardApi.list({ locale, home: true, latestLimit: 5 }, controller.signal)
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
    const latestArticles = boards.flatMap((board) => (board.latestArticles ?? []).map((article) => ({ board, article })));
    return <SiteLayout><main className="min-h-[calc(100vh-4.5rem)] w-full bg-[#F7FCFC]">
    <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="mb-2 text-[36px] font-extrabold tracking-tight text-white">{locale === 'ko' ? uiText("pages.board-hub-page.bd1011dee4") : 'Boards'}</h1>
        <p className="text-[24px] font-semibold tracking-tight text-white">{locale === 'ko' ? uiText("pages.board-hub-page.760ac028ce") : 'Latest articles'}</p>
      </div>
    </div>
    <div className="border-b border-kaist-grey/30">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-stretch gap-10 px-6">
        {boards.map((board) => <Link key={board.id} to={`/board/${board.code}`} className="relative flex items-center text-[28px] font-extrabold tracking-tight text-kaist-greygreen transition hover:text-kaist-darkgreen"><span className="py-5">{localizedText(board.title)}</span><span className="absolute bottom-0 left-0 right-0 h-1.5 origin-center scale-x-0 bg-kaist-darkgreen transition-transform duration-200 hover:scale-x-100"/></Link>)}
      </div>
    </div>
    <section className="mx-auto max-w-[1600px] px-6 pb-16 pt-10">
    {loading ? <p className="py-16 text-center text-base font-semibold text-kaist-grey">{locale === 'ko' ? uiText("pages.board-hub-page.7c8f6585ab") : 'Loading boards.'}</p> : error ? <p role="alert" className="py-16 text-center text-base font-semibold text-kaist-grey">{locale === 'ko' ? uiText("pages.board-hub-page.478d00882a") : 'Boards are unavailable.'}</p> : boards.length === 0 ? <p className="py-16 text-center text-base font-semibold text-kaist-grey">{locale === 'ko' ? uiText("pages.board-hub-page.491c2f6c70") : 'No boards are available.'}</p> : <div>
      <div className="grid grid-cols-12 gap-4 border-b-2 border-kaist-darkgreen-main py-4 text-sm font-extrabold tracking-tight text-kaist-darkgreen">
        <div className="col-span-1 text-center">번호</div>
        <div className="col-span-2 text-center">게시판</div>
        <div className="col-span-7 text-center">제목</div>
        <div className="col-span-2 text-center">작성일</div>
      </div>
      <div className="divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
        {latestArticles.length ? latestArticles.map(({ board, article }, index) => <Link key={article.id} to={`/board/${board.code}/${article.id}`} className="grid grid-cols-12 gap-4 py-4 transition-colors hover:bg-kaist-grey/5">
          <div className="col-span-1 grid place-content-center text-sm font-semibold text-kaist-grey">{latestArticles.length - index}</div>
          <div className="col-span-2 text-center"><span className="inline-block rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold tracking-tight text-white">{localizedText(board.title)}</span></div>
          <div className="col-span-7 flex min-w-0 items-center pl-8 text-sm font-semibold tracking-tight text-kaist-black"><span className="truncate">{localizedText(article.title)}</span></div>
          <div className="col-span-2 grid place-content-center text-xs font-medium tracking-tight text-kaist-grey">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('ko-KR') : ''}</div>
        </Link>) : <div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{locale === 'ko' ? uiText("pages.board-hub-page.6c484281b4") : 'No articles yet.'}</p></div>}
      </div>
    </div>}
    </section>
  </main></SiteLayout>;
}
