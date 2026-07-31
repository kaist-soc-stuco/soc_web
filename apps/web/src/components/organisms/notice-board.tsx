import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { loadBoardCatalog, useBoardCatalog } from '@/lib/board-catalog';

export function NoticeBoard() {
  const catalog = useBoardCatalog();
  const [activeCode, setActiveCode] = useState<string | null>(null);

  useEffect(() => {
    void loadBoardCatalog().catch(() => undefined);
  }, []);

  const selected = catalog.items.find((item) => item.code === activeCode) ?? catalog.items[0] ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col bg-kaist-white lg:pr-9" aria-label="게시판 바로가기">
      <div className="flex h-full min-h-0 w-full flex-col">
        {catalog.status === 'ready' && catalog.items.length > 0 ? (
          <>
            <div className="flex flex-shrink-0 flex-wrap items-stretch gap-3 border-b-2 border-kaist-grey/30 pl-1 lg:gap-5">
              {catalog.items.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setActiveCode(item.code)}
                  className={`border-b-4 px-1 py-1.5 text-base font-bold tracking-tight transition-colors ${
                    selected?.code === item.code
                      ? 'border-kaist-darkgreen text-kaist-darkgreen'
                      : 'border-transparent text-kaist-greygreen hover:text-kaist-darkgreen'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
            {selected && (
              <div className="flex flex-1 items-center justify-between gap-4 py-8">
                <div>
                  <p className="text-sm font-semibold text-kaist-grey">선택한 게시판</p>
                  <p className="mt-1 text-xl font-extrabold text-kaist-black">{selected.title}</p>
                </div>
                <Link
                  to={`/board/${encodeURIComponent(selected.code)}`}
                  className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-sm font-extrabold text-white"
                >
                  게시글 보기
                </Link>
              </div>
            )}
          </>
        ) : catalog.status === 'error' ? (
          <p role="alert" className="py-8 text-sm font-semibold text-red-700">게시판 정보를 불러오지 못했습니다.</p>
        ) : catalog.status === 'ready' ? (
          <p className="py-8 text-sm font-semibold text-kaist-grey">표시할 게시판이 없습니다.</p>
        ) : (
          <p role="status" className="py-8 text-sm font-semibold text-kaist-grey">게시판 정보를 불러오는 중입니다.</p>
        )}
      </div>
    </section>
  );
}
