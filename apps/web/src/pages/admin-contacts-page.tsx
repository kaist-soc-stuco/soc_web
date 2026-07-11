import { adminContactRows } from '@/lib/mock-data';

export function AdminContactsPage() {
  return (
    <section>
      <div className="mb-8 border-b border-kaist-grey/25 pb-5">
        <h2 className="text-[44px] font-extrabold tracking-tight text-kaist-black">집행위 연락망</h2>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-kaist-grey/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-[3px] border border-[#014f9a] bg-white px-4 py-1.5 text-sm text-kaist-black">2022</div>
          <span className="text-[20px] font-semibold text-kaist-black">학년도</span>
        </div>
        <div className="flex items-center gap-3 border-b border-[#86D8A7] px-1 pb-1">
          <span className="text-[18px] font-semibold text-[#86D8A7]">이름</span>
          <span className="text-kaist-darkgreen">⌕</span>
        </div>
      </div>

      <div className="overflow-hidden border-y border-kaist-darkgreen/70">
        <div className="grid grid-cols-[96px_1.1fr_1.2fr_2fr_1.5fr_1fr_0.8fr] items-center px-2 py-4 text-[20px] font-extrabold text-kaist-darkgreen">
          <div />
          <div>이름</div>
          <div>직책</div>
          <div>이메일</div>
          <div>전화번호</div>
          <div>직장</div>
          <div>비고</div>
        </div>

        <div className="divide-y divide-kaist-grey/10">
          {adminContactRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[96px_1.1fr_1.2fr_2fr_1.5fr_1fr_0.8fr] items-center px-2 py-3 text-[18px]"
            >
              <div className="flex justify-center">
                <div className="flex h-[57px] w-[57px] items-center justify-center rounded-full bg-[#d9dddf] text-[28px] text-black">
                  ●
                </div>
              </div>
              <div className="font-semibold text-kaist-darkgreen">{row.name}</div>
              <div className="font-semibold text-kaist-darkgreen">{row.role}</div>
              <div className="text-[#39404B]">{row.email}</div>
              <div className="text-[#39404B]">{row.phone}</div>
              <div className="text-[#39404B]">{row.affiliation}</div>
              <div className="text-[#39404B]">{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
