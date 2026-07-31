import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Board, ContentLocale } from '@soc/contracts';

import { SiteLayout } from '@/components/organisms/site-layout';
import { boardApi } from '@/lib/board-api';
import { localizedText } from '@/lib/localized-content';

export function BoardHubPage() {
  const [locale, setLocale] = useState<ContentLocale>('ko');
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    boardApi.list({ locale, latestLimit: 3 }, controller.signal)
      .then(({ items }) => setBoards(items.filter((board) => !board.config.isHidden)))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locale]);

  return <SiteLayout><main className="mx-auto min-h-[calc(100vh-4.5rem)] w-full bg-[#F7FCFC] px-[12vw] py-10">
    <div className="mb-8 flex items-center justify-between gap-4"><h1 className="text-3xl font-extrabold text-kaist-darkgreen">{locale === 'ko' ? '게시판' : 'Boards'}</h1><label className="text-sm font-semibold">Language <select aria-label="Language" value={locale} onChange={(event) => setLocale(event.target.value as ContentLocale)} className="ml-2 rounded border bg-white px-2 py-1"><option value="ko">한국어</option><option value="en">English</option></select></label></div>
    {loading ? <p>{locale === 'ko' ? '게시판을 불러오는 중입니다.' : 'Loading boards.'}</p> : error ? <p role="alert">{locale === 'ko' ? '게시판을 불러오지 못했습니다.' : 'Boards are unavailable.'}</p> : boards.length === 0 ? <p>{locale === 'ko' ? '게시판이 없습니다.' : 'No boards are available.'}</p> : <div className="grid gap-6 lg:grid-cols-2">{boards.map((board) => <section key={board.id} className="rounded-lg border border-kaist-grey/20 bg-white p-6 shadow-sm"><Link to={`/board/${board.code}`} className="text-xl font-extrabold text-kaist-darkgreen hover:underline">{localizedText(board.title)}</Link><p className="mt-2 text-sm text-kaist-grey">{localizedText(board.description)}</p><h2 className="mt-5 border-b pb-2 font-bold">{locale === 'ko' ? '최근 글' : 'Latest articles'}</h2><ul className="mt-2 grid gap-2">{board.latestArticles?.length ? board.latestArticles.map((article) => <li key={article.id}><Link className="hover:underline" to={`/board/${board.code}/${article.id}`}>{localizedText(article.title)}</Link></li>) : <li className="text-sm text-kaist-grey">{locale === 'ko' ? '등록된 글이 없습니다.' : 'No articles yet.'}</li>}</ul></section>)}</div>}
  </main></SiteLayout>;
}
