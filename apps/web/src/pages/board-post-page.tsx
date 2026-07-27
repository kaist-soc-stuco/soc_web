import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { boardApi } from '@/lib/board-api';
import type { Article, Board } from '@soc/contracts';

export function BoardPostPage() {
  const { category = 'notice', id } = useParams<{ category: string; id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageContainerClass = 'mx-auto w-full px-[12vw]';

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.all([boardApi.article(id, 'ko', controller.signal), boardApi.get(category, 'ko', controller.signal)])
      .then(([detail, boardResponse]) => {
        setArticle(detail.article);
        setBoard(boardResponse.board);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name !== 'AbortError') setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, id]);

  const date = article?.publishedAt ?? article?.updatedAt;
  return (
    <div className="min-h-screen flex flex-col bg-[#F7FCFC]"><Header showLogo />
      <main className="flex-1 w-full mx-auto">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8"><div className={pageContainerClass}>
          <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">{board?.title.value ?? category} 게시판</h1>
          {board?.description.value && <p className="text-[20px] font-semibold tracking-tight text-kaist-white">{board.description.value}</p>}
        </div></div>
        <div className={`${pageContainerClass} pb-16 py-2`}>
          {loading && <p className="py-16 text-center text-kaist-grey">게시글을 불러오는 중입니다.</p>}
          {!loading && (error || !id) && <p className="py-16 text-center text-kaist-grey">게시글을 불러오지 못했습니다.</p>}
          {!loading && !error && id && !article && <p className="py-16 text-center text-kaist-grey">게시글이 없습니다.</p>}
          {!loading && !error && article && <>
            <div className="flex flex-col gap-5 border-b-2 border-kaist-darkgreen-main py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8"><div className="min-w-0">
              <span className="mb-3 inline-block w-fit rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold text-kaist-white lg:text-sm">{board?.title.value ?? category}</span>
              <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-kaist-black lg:text-[28px]">{article.title.value}</h2>
              {date && <div className="pt-1 text-sm font-medium text-kaist-grey">{new Date(date).toLocaleDateString('ko-KR')}</div>}
            </div><Link to={`/board/${category}`} className="rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold text-kaist-darkgreen">글 목록</Link></div>
            <div className="py-7 lg:py-8"><div className="whitespace-pre-line text-sm font-medium leading-7 tracking-tight text-kaist-black">{article.body.value}</div></div>
          </>}
        </div>
      </main>
    </div>
  );
}
