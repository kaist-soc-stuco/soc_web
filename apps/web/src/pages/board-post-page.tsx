import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { RelatedContentCards } from '@/components/organisms/related-content-cards';
import { boardApi } from '@/lib/board-api';
import type { Article, Board, Comment, ReactionType } from '@soc/contracts';
import { useLocale } from '@/lib/locale-store';
import { ChevronDown, ChevronUp } from 'lucide-react';
export function BoardPostPage() {
    const [locale] = useLocale();
    const { category = 'soc-notice', id } = useParams<{
        category: string;
        id: string;
    }>();
    const [article, setArticle] = useState<Article | null>(null);
    const [board, setBoard] = useState<Board | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [reaction, setReaction] = useState<ReactionType | null>(null);
    const [likeCount, setLikeCount] = useState(0);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [commentBody, setCommentBody] = useState('');
    const [interactionError, setInteractionError] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const pageContainerClass = 'mx-auto max-w-7xl';
    const requestId = useRef(0);
    useEffect(() => {
        const activeRequest = ++requestId.current;
        setArticle(null);
        setBoard(null);
        setError(false);
        setComments([]);
        setReaction(null);
        setLikeCount(0);
        if (!id) {
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        Promise.all([boardApi.article(id, locale, controller.signal), boardApi.get(category, locale, controller.signal)])
            .then(([detail, boardResponse]) => {
            if (activeRequest !== requestId.current)
                return;
            if (detail.article.boardCode !== category) {
                setError(true);
                return;
            }
            setArticle(detail.article);
            setComments(detail.comments);
            setReaction(detail.myReaction);
            setLikeCount(detail.likeCount);
            setBoard(boardResponse.board);
        })
            .catch((cause: unknown) => {
            if (activeRequest === requestId.current && (cause as {
                name?: string;
            }).name !== 'AbortError')
                setError(true);
        })
            .finally(() => {
            if (activeRequest === requestId.current)
                setLoading(false);
        });
        return () => controller.abort();
    }, [category, id, locale]);
    const date = article?.publishedAt ?? article?.updatedAt;
    const addComment = async () => {
        if (!id || !commentBody.trim())
            return;
        setInteractionError('');
        try {
            const created = await boardApi.createComment(id, { body: commentBody.trim(), ...(replyTo ? { parentCommentId: replyTo } : {}) });
            setComments((current) => [...current, created]);
            setCommentBody('');
            setReplyTo(null);
        }
        catch {
            setInteractionError(uiText("pages.board-post-page.39767a9258"));
        }
    };
    const editComment = async (comment: Comment) => {
        const body = window.prompt(uiText("pages.board-post-page.3e99d95532"), comment.body ?? '');
        if (!body?.trim())
            return;
        setEditingCommentId(comment.id);
        try {
            const updated = await boardApi.patchComment(comment.id, { body: body.trim() });
            setComments((current) => current.map((item) => item.id === updated.id ? updated : item));
        }
        catch {
            setInteractionError(uiText("pages.board-post-page.ec1aa4b39f"));
        }
        finally {
            setEditingCommentId(null);
        }
    };
    const deleteComment = async (comment: Comment) => {
        setEditingCommentId(comment.id);
        try {
            await boardApi.deleteComment(comment.id);
            setComments((current) => current.map((item) => item.id === comment.id ? { ...item, body: null, status: 'DELETED', canEdit: false, canDelete: false } : item));
        }
        catch {
            setInteractionError(uiText("pages.board-post-page.9785ceeac9"));
        }
        finally {
            setEditingCommentId(null);
        }
    };
    const react = async (type: ReactionType) => {
        if (!id)
            return;
        setInteractionError('');
        try {
            const result = reaction === type ? await boardApi.deleteReaction(id) : await boardApi.putReaction(id, { type });
            setReaction(result.type);
            setLikeCount(result.likeCount);
        }
        catch {
            setInteractionError(uiText("pages.board-post-page.dae2c9a96f"));
        }
    };
    return (<div className="min-h-screen flex flex-col bg-kaist-white"><Header showLogo/>
      <main className="flex-1 w-full mx-auto">
        <div className="bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 px-8 py-12"><div className={pageContainerClass}>
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-kaist-white">{board?.title.value ?? category}{uiText("pages.board-post-page.bd1011dee4")}</h1>
          {board?.description.value && <p className="text-base font-medium tracking-tight text-kaist-white/90">{board.description.value}</p>}
        </div></div>
        <div className={`${pageContainerClass} pb-16`}>
          {loading && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.82a2f0865b")}</p>}
          {!loading && (error || !id) && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.9f4895d2f8")}</p>}
          {!loading && !error && id && !article && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.1ce50cf815")}</p>}
          {!loading && !error && article && <>
            <div className="flex items-start justify-between gap-8 pb-4 pt-8"><div className="min-w-0">
              <span className="mb-3 inline-block w-fit rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold tracking-tight text-kaist-white">{board?.title.value ?? category}</span>
              <h2 className="mb-2 text-xl font-extrabold tracking-tight text-kaist-black">{article.title.value}</h2>
              <div className="flex flex-wrap items-center gap-2 pt-2 text-sm font-medium tracking-tight text-kaist-grey">
                <span className="font-semibold text-kaist-black">No. {article.publicNo}</span>
                {date && <><span className="text-kaist-grey">|</span><span>{new Date(date).toLocaleDateString('ko-KR')}</span></>}
              </div>
            </div><div className="flex shrink-0 gap-3"><Link to={`/board/${category}`} className="flex items-center gap-2 border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-kaist-white"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>{uiText("pages.board-post-page.78cffb3bb7")}</Link><Link to={`/board/${category}/write`} className="flex items-center gap-2 border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-white transition-colors hover:bg-kaist-darkgreen-main">{uiText("pages.board-page.b22f31b432")}</Link></div></div>
            <div className="border-t-2 border-kaist-darkgreen"/>
            <div className="py-8"><div className="whitespace-pre-line text-sm font-medium leading-relaxed tracking-tight text-kaist-black">{article.body.value}</div></div>
            <RelatedContentCards subject={{ articleId: article.id }} locale={locale}/>
            {board?.config.reactionsAllowed ? <div className="flex gap-2 border-t border-kaist-grey/30 py-5"><button aria-pressed={reaction === 'LIKE'} onClick={() => void react('LIKE')} className="border border-kaist-darkgreen px-4 py-2 text-sm font-extrabold text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-white">{uiText("pages.board-post-page.224a288614")}{likeCount}{reaction === 'LIKE' ? uiText("pages.board-post-page.1a9867c680") : ''}</button></div> : null}
            {board?.config.commentsAllowed ? <section className="border-t border-kaist-grey/30 py-6"><h3 className="text-xl font-extrabold">{uiText("pages.board-post-page.6d4e9bd3a9")}</h3><ul className="mt-4 divide-y divide-kaist-grey/20">{comments.map((comment) => <li key={comment.id} className={`py-3 text-sm ${comment.parentCommentId ? 'ml-8 border-l pl-4' : ''}`}><div className="mb-1 font-bold">{comment.authorNameKr}</div><div>{comment.status === 'DELETED' ? uiText("pages.board-post-page.dc780f40d0") : comment.status === 'SECRET' ? uiText("pages.board-post-page.7eef22c9b1") : comment.body}</div>{comment.status !== 'DELETED' ? <div className="mt-2 flex gap-3">{comment.parentCommentId === null ? <button type="button" onClick={() => setReplyTo(comment.id)} className="text-kaist-darkgreen">{uiText("pages.board-post-page.3e69f37d58")}</button> : null}{comment.canEdit ? <button type="button" disabled={editingCommentId === comment.id} onClick={() => void editComment(comment)} className="text-kaist-darkgreen">{uiText("pages.board-post-page.e1407b5115")}</button> : null}{comment.canDelete ? <button type="button" disabled={editingCommentId === comment.id} onClick={() => void deleteComment(comment)} className="text-red-700">{uiText("pages.board-post-page.fc81e222b9")}</button> : null}</div> : null}</li>)}</ul>{replyTo ? <div className="mt-3 text-sm">{uiText("pages.board-post-page.9bebaac80b")}<button type="button" onClick={() => setReplyTo(null)} className="underline">{uiText("pages.board-post-page.19b2d19bc1")}</button></div> : null}<div className="mt-4 flex gap-2"><textarea aria-label={replyTo ? uiText("pages.board-post-page.3e69f37d58") : uiText("pages.board-post-page.6d4e9bd3a9")} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} className="min-h-20 flex-1 rounded border px-3 py-2"/><button disabled={!commentBody.trim()} onClick={() => void addComment()} className="self-end rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-50">{uiText("pages.board-post-page.1ac11e9b41")}</button></div></section> : null}
            <div>
              <Link to={`/board/${category}`} className="flex items-center gap-4 border-t border-b border-kaist-grey/30 py-3 transition-colors hover:bg-kaist-grey/5">
                <ChevronUp className="h-4 w-4 shrink-0 text-kaist-darkgreen-main"/>
                <span className="w-10 shrink-0 text-xs font-semibold text-kaist-grey">{locale === 'ko' ? '이전글' : 'Previous'}</span>
                <span className="flex-1 truncate text-sm font-semibold tracking-tight text-kaist-black">{locale === 'ko' ? '목록에서 이전 글을 확인하세요' : 'Check previous posts from the list'}</span>
              </Link>
              <Link to={`/board/${category}`} className="flex items-center gap-4 border-b border-kaist-grey/30 py-3 transition-colors hover:bg-kaist-grey/5">
                <ChevronDown className="h-4 w-4 shrink-0 text-kaist-darkgreen-main"/>
                <span className="w-10 shrink-0 text-xs font-semibold text-kaist-grey">{locale === 'ko' ? '다음글' : 'Next'}</span>
                <span className="flex-1 truncate text-sm font-semibold tracking-tight text-kaist-black">{locale === 'ko' ? '목록에서 다음 글을 확인하세요' : 'Check next posts from the list'}</span>
              </Link>
            </div>
            {interactionError ? <p role="alert" className="pb-4 text-sm text-red-600">{interactionError}</p> : null}
          </>}
        </div>
      </main>
    </div>);
}
