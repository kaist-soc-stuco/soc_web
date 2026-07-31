import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { boardApi } from '@/lib/board-api';
import type { Article, Board, Comment, ReactionType } from '@soc/contracts';

export function BoardPostPage() {
  const { category = 'soc-notice', id } = useParams<{ category: string; id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [interactionError, setInteractionError] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const requestId = useRef(0);

  useEffect(() => {
    const activeRequest = ++requestId.current;
    setArticle(null);
    setBoard(null);
    setError(false);
    setComments([]);
    setReaction(null);
    if (!id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    Promise.all([boardApi.article(id, 'ko', controller.signal), boardApi.get(category, 'ko', controller.signal)])
      .then(([detail, boardResponse]) => {
        if (activeRequest !== requestId.current) return;
        if (detail.article.boardCode !== category) {
          setError(true);
          return;
        }
        setArticle(detail.article);
        setComments(detail.comments);
        setReaction(detail.myReaction);
        setBoard(boardResponse.board);
      })
      .catch((cause: unknown) => {
        if (activeRequest === requestId.current && (cause as { name?: string }).name !== 'AbortError') setError(true);
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });
    return () => controller.abort();
  }, [category, id]);

  const date = article?.publishedAt ?? article?.updatedAt;
  const addComment = async () => {
    if (!id || !commentBody.trim()) return;
    setInteractionError('');
    try {
      const created = await boardApi.createComment(id, { body: commentBody.trim() });
      setComments((current) => [...current, created]);
      setCommentBody('');
    } catch { setInteractionError('댓글을 등록하지 못했습니다. 로그인과 게시판 권한을 확인해 주세요.'); }
  };
  const react = async (type: ReactionType) => {
    if (!id) return;
    setInteractionError('');
    try {
      const result = reaction === type ? await boardApi.deleteReaction(id) : await boardApi.putReaction(id, { type });
      setReaction(result.type);
    } catch { setInteractionError('반응을 저장하지 못했습니다.'); }
  };
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
            {board?.config.reactionsAllowed ? <div className="flex gap-2 border-t py-5"><button aria-pressed={reaction === 'LIKE'} onClick={() => void react('LIKE')} className="rounded border px-4 py-2">좋아요{reaction === 'LIKE' ? ' 취소' : ''}</button><button aria-pressed={reaction === 'DISLIKE'} onClick={() => void react('DISLIKE')} className="rounded border px-4 py-2">싫어요{reaction === 'DISLIKE' ? ' 취소' : ''}</button></div> : null}
            {board?.config.commentsAllowed ? <section className="border-t py-6"><h3 className="text-xl font-extrabold">댓글</h3><ul className="mt-4 divide-y">{comments.map((comment) => <li key={comment.id} className="py-3 text-sm">{comment.status === 'DELETED' ? '삭제된 댓글입니다.' : comment.status === 'SECRET' ? '비밀 댓글' : comment.body}</li>)}</ul><div className="mt-4 flex gap-2"><textarea aria-label="댓글" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} className="min-h-20 flex-1 rounded border px-3 py-2" /><button disabled={!commentBody.trim()} onClick={() => void addComment()} className="self-end rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-50">등록</button></div></section> : null}
            {interactionError ? <p role="alert" className="pb-4 text-sm text-red-600">{interactionError}</p> : null}
          </>}
        </div>
      </main>
    </div>
  );
}
