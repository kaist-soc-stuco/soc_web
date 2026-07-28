import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { boardApi } from '@/lib/board-api';

export function BoardWritePage() {
  const { category = 'soc-notice' } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [boardTitle, setBoardTitle] = useState(category);
  const [boardDescription, setBoardDescription] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [boardReady, setBoardReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const activeRequest = ++requestId.current;
    setLoading(true);
    setBoardReady(false);
    setError(null);
    setBoardTitle(category);
    setBoardDescription('');
    boardApi.get(category, 'ko', controller.signal)
      .then(({ board }) => {
        if (activeRequest !== requestId.current) return;
        setBoardTitle(board.title.value ?? '');
        setBoardDescription(board.description.value ?? '');
        setBoardReady(true);
      })
      .catch((cause: unknown) => {
        if (activeRequest === requestId.current && (cause as { name?: string }).name !== 'AbortError') setError('게시판 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });
    return () => controller.abort();
  }, [category]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boardReady) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError('제목과 본문을 입력해 주세요.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const draft = await boardApi.createDraft(category, {
        titleKr: trimmedTitle,
        titleEn: trimmedTitle,
        bodyKr: trimmedBody,
        bodyEn: trimmedBody,
        scope: 'ALL',
      });
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
          {loading ? <p className="py-12 text-center text-kaist-grey">게시판 정보를 불러오는 중입니다.</p> : !boardReady ? <p role="alert" className="py-12 text-center text-kaist-grey">{error ?? '게시판 정보를 불러오지 못했습니다.'}</p> : <form onSubmit={submit}>
            <div className="grid gap-5 py-7 lg:py-8">
              <label className="grid gap-3"><span className="text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-base">제목</span><input required value={title} onChange={(event) => setTitle(event.target.value)} type="text" placeholder="게시글 제목을 입력하세요" className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 text-sm font-medium tracking-tight text-kaist-black outline-none transition focus:border-kaist-darkgreen lg:text-base" /></label>
              <label className="grid gap-3"><span className="text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-base">본문</span><textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={12} placeholder="게시글 내용을 입력하세요" className="min-h-[280px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4 text-sm font-medium leading-7 tracking-tight text-kaist-black outline-none transition focus:border-kaist-darkgreen" /></label>
            </div>
            {error && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-kaist-grey/20 pt-6"><Link to={`/board/${category}`} className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen">취소</Link><button disabled={pending || !boardReady} type="submit" className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-2 text-sm font-extrabold tracking-tight text-white disabled:opacity-50">{pending ? '등록 중...' : '등록하기'}</button></div>
          </form>}
        </section>
      </div>
    </SiteLayout>
  );
}
