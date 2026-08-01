import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArticleSummary, Board } from '@soc/contracts';

import { boardApi } from '@/lib/board-api';
import { useLocale } from '@/lib/locale-store';

type HomeBoard = Board & { latestArticles?: ArticleSummary[] };
type LoadState = 'loading' | 'ready' | 'error';

export function NoticeBoard() {
  const [locale] = useLocale();
  const [boards, setBoards] = useState<HomeBoard[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    boardApi.list({ home: true, latestLimit: 1, locale }, controller.signal)
      .then(({ items }) => {
        setBoards(items);
        setActiveCode((current) => items.some((item) => item.code === current) ? current : items[0]?.code ?? null);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('error');
      });
    return () => controller.abort();
  }, [locale]);

  const selected = boards.find((item) => item.code === activeCode) ?? boards[0] ?? null;
  const articles = selected?.latestArticles ?? [];

  return (
    <section className="flex h-full min-h-0 flex-col bg-kaist-white lg:pr-9" aria-label="게시판 미리보기">
      {status === 'ready' && boards.length > 0 ? (
        <>
          <div className="flex flex-shrink-0 flex-wrap items-stretch gap-3 border-b-2 border-kaist-grey/30 pl-1 lg:gap-5">
            {boards.map((board) => (
              <button
                key={board.code}
                type="button"
                onClick={() => setActiveCode(board.code)}
                className={`border-b-4 px-1 py-1.5 text-base font-bold tracking-tight transition-colors ${selected?.code === board.code ? 'border-kaist-darkgreen text-kaist-darkgreen' : 'border-transparent text-kaist-greygreen hover:text-kaist-darkgreen'}`}
              >
                {board.title.value}
              </button>
            ))}
          </div>
          {selected && (
            <div className="flex flex-1 flex-col py-4">
              {articles.length > 0 ? (
                <ul className="divide-y divide-kaist-grey/20">
                  {articles.map((article) => (
                    <li key={article.id}>
                      <Link to={`/board/${encodeURIComponent(article.boardCode)}/${encodeURIComponent(article.id)}`} className="flex items-center justify-between gap-4 py-3 hover:text-kaist-darkgreen">
                        <span className="min-w-0 truncate text-sm font-bold">{article.isPinned && <span className="mr-2 text-kaist-darkgreen">고정</span>}{article.title.value ?? '제목 없음'}</span>
                        <time className="shrink-0 text-xs font-semibold text-kaist-grey" dateTime={article.publishedAt ?? article.updatedAt}>{new Date(article.publishedAt ?? article.updatedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="py-6 text-sm font-semibold text-kaist-grey">최근 게시글이 없습니다.</p>}
              <Link to={`/board/${encodeURIComponent(selected.code)}`} className="mt-auto self-end rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-sm font-extrabold text-white">게시판 전체 보기</Link>
            </div>
          )}
        </>
      ) : status === 'error' ? (
        <p role="alert" className="py-8 text-sm font-semibold text-red-700">게시글을 불러오지 못했습니다.</p>
      ) : status === 'ready' ? (
        <p className="py-8 text-sm font-semibold text-kaist-grey">표시할 게시판이 없습니다.</p>
      ) : (
        <p role="status" className="py-8 text-sm font-semibold text-kaist-grey">게시글을 불러오는 중입니다.</p>
      )}
    </section>
  );
}
