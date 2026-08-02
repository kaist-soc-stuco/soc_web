import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { RelatedContentCards } from '@/components/organisms/related-content-cards';
import { boardApi } from '@/lib/board-api';
import type { Article, Board, Comment, ReactionType } from '@soc/contracts';
import { useLocale } from '@/lib/locale-store';
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
    const pageContainerClass = 'mx-auto w-full px-[12vw]';
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
    return (<div className="min-h-screen flex flex-col bg-[#F7FCFC]"><Header showLogo/>
      <main className="flex-1 w-full mx-auto">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8"><div className={pageContainerClass}>
          <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">{board?.title.value ?? category}{uiText("pages.board-post-page.bd1011dee4")}</h1>
          {board?.description.value && <p className="text-[20px] font-semibold tracking-tight text-kaist-white">{board.description.value}</p>}
        </div></div>
        <div className={`${pageContainerClass} pb-16 py-2`}>
          {loading && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.82a2f0865b")}</p>}
          {!loading && (error || !id) && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.9f4895d2f8")}</p>}
          {!loading && !error && id && !article && <p className="py-16 text-center text-kaist-grey">{uiText("pages.board-post-page.1ce50cf815")}</p>}
          {!loading && !error && article && <>
            <div className="flex flex-col gap-5 border-b-2 border-kaist-darkgreen-main py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8"><div className="min-w-0">
              <span className="mb-3 inline-block w-fit rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold text-kaist-white lg:text-sm">{board?.title.value ?? category}</span>
              <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-kaist-black lg:text-[28px]">{article.title.value}</h2>
              {date && <div className="pt-1 text-sm font-medium text-kaist-grey">{new Date(date).toLocaleDateString('ko-KR')}</div>}
            </div><Link to={`/board/${category}`} className="rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold text-kaist-darkgreen">{uiText("pages.board-post-page.78cffb3bb7")}</Link></div>
            <div className="py-7 lg:py-8"><div className="whitespace-pre-line text-sm font-medium leading-7 tracking-tight text-kaist-black">{article.body.value}</div></div>
            <RelatedContentCards subject={{ articleId: article.id }} locale={locale}/>
            {board?.config.reactionsAllowed ? <div className="flex gap-2 border-t py-5"><button aria-pressed={reaction === 'LIKE'} onClick={() => void react('LIKE')} className="rounded border px-4 py-2">{uiText("pages.board-post-page.224a288614")}{likeCount}{reaction === 'LIKE' ? uiText("pages.board-post-page.1a9867c680") : ''}</button></div> : null}
            {board?.config.commentsAllowed ? <section className="border-t py-6"><h3 className="text-xl font-extrabold">{uiText("pages.board-post-page.6d4e9bd3a9")}</h3><ul className="mt-4 divide-y">{comments.map((comment) => <li key={comment.id} className={`py-3 text-sm ${comment.parentCommentId ? 'ml-8 border-l pl-4' : ''}`}><div className="mb-1 font-bold">{comment.authorNameKr}</div><div>{comment.status === 'DELETED' ? uiText("pages.board-post-page.dc780f40d0") : comment.status === 'SECRET' ? uiText("pages.board-post-page.7eef22c9b1") : comment.body}</div>{comment.status !== 'DELETED' ? <div className="mt-2 flex gap-3">{comment.parentCommentId === null ? <button type="button" onClick={() => setReplyTo(comment.id)} className="text-kaist-darkgreen">{uiText("pages.board-post-page.3e69f37d58")}</button> : null}{comment.canEdit ? <button type="button" disabled={editingCommentId === comment.id} onClick={() => void editComment(comment)} className="text-kaist-darkgreen">{uiText("pages.board-post-page.e1407b5115")}</button> : null}{comment.canDelete ? <button type="button" disabled={editingCommentId === comment.id} onClick={() => void deleteComment(comment)} className="text-red-700">{uiText("pages.board-post-page.fc81e222b9")}</button> : null}</div> : null}</li>)}</ul>{replyTo ? <div className="mt-3 text-sm">{uiText("pages.board-post-page.9bebaac80b")}<button type="button" onClick={() => setReplyTo(null)} className="underline">{uiText("pages.board-post-page.19b2d19bc1")}</button></div> : null}<div className="mt-4 flex gap-2"><textarea aria-label={replyTo ? uiText("pages.board-post-page.3e69f37d58") : uiText("pages.board-post-page.6d4e9bd3a9")} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} className="min-h-20 flex-1 rounded border px-3 py-2"/><button disabled={!commentBody.trim()} onClick={() => void addComment()} className="self-end rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-50">{uiText("pages.board-post-page.1ac11e9b41")}</button></div></section> : null}
            {interactionError ? <p role="alert" className="pb-4 text-sm text-red-600">{interactionError}</p> : null}
          </>}
        </div>
      </main>
    </div>);
}
