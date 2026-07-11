export function AdminEmailsPage() {
  return (
    <section className="mx-auto max-w-6xl border border-[#e3e8e6] bg-white">
      <div className="border-b border-[#eef2ef] bg-[#faf8f8] px-4 py-3 text-sm text-kaist-darkgreen">보내기</div>

      <div className="grid gap-0 border-b border-[#eef2ef]">
        {[
          ['받는 사람', '이름, 메일 주소를 입력해 주세요.'],
          ['참조', '이름, 메일 주소를 입력해 주세요.'],
          ['제목', '제목을 입력해 주세요.'],
        ].map(([label, placeholder]) => (
          <div key={label} className="grid grid-cols-[120px_1fr_120px] items-center border-b border-[#eef2ef] px-5 py-4 last:border-b-0">
            <div className="text-sm font-bold text-kaist-black">{label}</div>
            <div className="border-b border-[#d9dfdc] pb-1 text-sm text-kaist-grey">{placeholder}</div>
            <div className="text-right text-xs text-kaist-grey">{label === '받는 사람' ? '개별' : label === '참조' ? '숨은 참조' : '중요'}</div>
          </div>
        ))}
      </div>

      <div className="border-b border-[#eef2ef] px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-kaist-grey">
          <span>기본글꼴</span>
          <span>14px</span>
          <span>B</span>
          <span>I</span>
          <span>U</span>
          <span>S</span>
          <span>정렬</span>
          <span>목록</span>
          <span>링크</span>
        </div>
        <div className="min-h-[260px] bg-white text-sm text-kaist-black">|</div>
      </div>

      <div className="flex items-center justify-between bg-[#faf8f8] px-4 py-3">
        <button className="rounded-[2px] bg-kaist-darkgreen px-4 py-1.5 text-xs font-bold text-white">보내기</button>
        <div className="flex items-center gap-2 text-[11px] text-kaist-grey">
          <span className="rounded-[2px] bg-white px-2 py-1">HTML</span>
          <span className="rounded-[2px] bg-white px-2 py-1">텍스트</span>
        </div>
      </div>
    </section>
  );
}
