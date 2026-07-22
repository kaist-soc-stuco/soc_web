import { adminContactRows } from '@/lib/mock-data';

export function AdminContactsPage() {
  return (
    <section>
      <div className="mb-8 border-b border-kaist-grey/25 pb-5">
        <h1 className="text-[36px] font-extrabold tracking-tight text-kaist-black lg:text-[44px]">집행위 연락망</h1>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-kaist-grey/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-1.5 text-sm font-semibold text-kaist-black">2022</div>
          <span className="text-[18px] font-extrabold text-kaist-black">학년도</span>
        </div>
        <div className="flex items-center gap-3 border-b border-kaist-darkgreen/40 px-1 pb-1">
          <span className="text-[18px] font-semibold text-[#9AA69F]">이름</span>
          <span className="text-kaist-darkgreen">⌕</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1040px] grid-cols-[96px_1.1fr_1.2fr_2fr_1.5fr_1fr_0.8fr] items-center border-b-3 border-kaist-darkgreen-main py-4 text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-lg">
          <div />
          <div className="text-center">이름</div>
          <div className="text-center">직책</div>
          <div className="text-center">이메일</div>
          <div className="text-center">전화번호</div>
          <div className="text-center">직장</div>
          <div className="text-center">비고</div>
        </div>

        <div className="min-w-[1040px] divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
          {adminContactRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[96px_1.1fr_1.2fr_2fr_1.5fr_1fr_0.8fr] items-center py-4 text-sm transition-colors hover:bg-kaist-grey/5 lg:text-base"
            >
              <div className="flex justify-center">
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-kaist-grey/15 text-[14px] font-extrabold text-kaist-darkgreen">
                  {row.name.slice(0, 1)}
                </div>
              </div>
              <div className="text-center font-semibold text-kaist-darkgreen">{row.name}</div>
              <div className="text-center font-semibold text-kaist-darkgreen">{row.role}</div>
              <div className="truncate text-center font-semibold text-[#39404B]">{row.email}</div>
              <div className="text-center font-semibold text-[#39404B]">{row.phone}</div>
              <div className="text-center font-semibold text-[#39404B]">{row.affiliation}</div>
              <div className="text-center font-semibold text-[#39404B]">{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
