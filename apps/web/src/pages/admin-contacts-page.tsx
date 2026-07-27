
export function AdminContactsPage() {
  return (
    <section>
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">집행위 연락망</h1>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-kaist-grey/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-1.5 text-sm font-semibold text-kaist-black">2022</div>
          <span className="text-base font-extrabold text-kaist-black">학년도</span>
        </div>
        <div className="flex items-center gap-3 border-b border-kaist-darkgreen/40 px-1 pb-1">
          <span className="text-base font-semibold text-[#9AA69F]">이름</span>
          <span className="text-kaist-darkgreen">⌕</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1040px] grid-cols-[96px_1.1fr_1.2fr_2fr_1.5fr_1fr_0.8fr] items-center border-b-2 border-kaist-darkgreen-main py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-base">
          <div />
          <div className="text-center">이름</div>
          <div className="text-center">직책</div>
          <div className="text-center">이메일</div>
          <div className="text-center">전화번호</div>
          <div className="text-center">직장</div>
          <div className="text-center">비고</div>
        </div>

        <div className="min-w-[1040px] divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
          <div className="py-8 text-center text-sm font-semibold text-[#39404B]">
            연락처 정보는 현재 제공되지 않습니다.
          </div>
        </div>
      </div>
    </section>
  );
}
