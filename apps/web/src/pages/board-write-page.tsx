import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { boardApi } from '@/lib/board-api';
import { useLocale } from '@/lib/locale-store';
import type { Board } from '@soc/contracts';
import { useAuthSession } from '@/lib/auth-session';
import { useAdminGrants } from '@/lib/admin-grants';
import { canCreateBoardArticle } from '@/lib/board-capabilities';

export function BoardWritePage() {
  const [locale] = useLocale();
  const auth = useAuthSession();
  const grants = useAdminGrants();
  const { category = 'soc-notice' } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const grants = useAdminGrants();
  const bilingual = grants.status === 'ready' && grants.grants.some((grant) => grant.permission === 'BOARD_MANAGE' && grant.scope === 'GLOBAL');
  const [boardTitle, setBoardTitle] = useState(category);
  const [boardDescription, setBoardDescription] = useState('');
  const [titleKr, setTitleKr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyKr, setBodyKr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
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
        if (activeRequest !== requestId.current) return;
        setBoardTitle(board.title.value ?? '');
        setBoardDescription(board.description.value ?? '');
        setBoardReady(true);
        setBoard(board);
      })
      .catch((cause: unknown) => {
        if (activeRequest === requestId.current && (cause as { name?: string }).name !== 'AbortError') setError('게시판 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });
    return () => controller.abort();
  }, [category, locale]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boardReady || !canCreate) return;
    const values = bilingual
      ? { titleKr: titleKr.trim(), titleEn: titleEn.trim(), bodyKr: bodyKr.trim(), bodyEn: bodyEn.trim() }
      : { title: titleKr.trim(), body: bodyKr.trim() };
    if (Object.values(values).some((value) => !value)) {
      setError(bilingual ? '한국어와 영어 제목 및 본문을 모두 입력해 주세요.' : '제목과 본문을 입력해 주세요.');
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
      const published = await boardApi.publish(draft.id);
      navigate(`/board/${category}/${published.id}`);
    } catch {
      setError('게시글 등록에 실패했습니다.');
    } finally {
      setPending(false);
    }
  };

  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-4.5rem)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8"><div className={pageContainerClass}>
          <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-white">{boardTitle} 글 작성</h1>
          {boardDescription && <p className="text-[20px] font-semibold tracking-tight text-white">{boardDescription}</p>}
        </div></div>
        <section className={`${pageContainerClass} pb-16 py-2`}>
          <div className="border-b-2 border-kaist-darkgreen-main py-5"><h2 className="text-2xl font-extrabold tracking-tight text-kaist-black lg:text-[28px]">게시글 작성</h2><p className="mt-2 text-sm font-semibold tracking-tight text-kaist-grey">{boardTitle} 게시판에 등록할 내용을 입력하세요.</p></div>
          {loading || capabilityLoading ? <p className="py-12 text-center text-kaist-grey">게시판 정보와 작성 권한을 확인하는 중입니다.</p> : !boardReady ? <p role="alert" className="py-12 text-center text-kaist-grey">{error ?? '게시판 정보를 불러오지 못했습니다.'}</p> : !canCreate ? <div role="alert" className="py-12 text-center text-kaist-grey"><p>이 게시판에 글을 작성할 권한이 없습니다.</p><Link to={`/board/${category}`} className="mt-4 inline-block font-bold text-kaist-darkgreen underline">게시판으로 돌아가기</Link></div> : <form onSubmit={submit}>
            <div className={`grid gap-5 py-7 lg:py-8 ${bilingual ? 'lg:grid-cols-2' : ''}`}>
              <fieldset className="grid gap-5"><legend className="mb-3 text-lg font-extrabold text-kaist-darkgreen">{bilingual ? '한국어' : '게시글'}</legend>
                <label className="grid gap-3"><span className="text-sm font-extrabold">제목</span><input required value={titleKr} onChange={(event) => setTitleKr(event.target.value)} type="text" className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3" /></label>
                <label className="grid gap-3"><span className="text-sm font-extrabold">본문</span><textarea required value={bodyKr} onChange={(event) => setBodyKr(event.target.value)} rows={12} className="min-h-[280px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4" /></label>
              </fieldset>
              {bilingual ? <fieldset className="grid gap-5"><legend className="mb-3 text-lg font-extrabold text-kaist-darkgreen">English</legend>
                <label className="grid gap-3"><span className="text-sm font-extrabold">Title</span><input required value={titleEn} onChange={(event) => setTitleEn(event.target.value)} type="text" className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3" /></label>
                <label className="grid gap-3"><span className="text-sm font-extrabold">Body</span><textarea required value={bodyEn} onChange={(event) => setBodyEn(event.target.value)} rows={12} className="min-h-[280px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4" /></label>
              </fieldset> : null}
            </div>
            <label className="mb-6 grid gap-2"><span className="text-sm font-extrabold text-kaist-darkgreen">첨부파일 (선택)</span><input aria-label="첨부파일" type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label>
            {error && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-kaist-grey/20 pt-6"><Link to={`/board/${category}`} className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen">취소</Link><button disabled={pending || !boardReady} type="submit" className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-2 text-sm font-extrabold tracking-tight text-white disabled:opacity-50">{pending ? '등록 중...' : '등록하기'}</button></div>
          </form>}
        </section>
      </div>
    </SiteLayout>
  );
}
