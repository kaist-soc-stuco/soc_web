interface NoticeItemProps {
  category: string;
  title: string;
  date: string;
}

function NoticeItem({ category, title, date }: NoticeItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="inline-flex items-center rounded-full bg-kaist-darkgreen px-2 py-0.5 text-xs font-semibold tracking-tight text-kaist-white flex-shrink-0">
          {category}
        </span>
        <span className="text-sm font-semibold tracking-tight text-kaist-black truncate">
          {title}
        </span>
      </div>
      <span className="text-xs font-semibold tracking-tight text-kaist-grey flex-shrink-0">
        {date}
      </span>
    </div>
  );
}

export function NoticeBoard() {
  const tabs = [
    { label: '공지', active: true },
    { label: '행사', active: false },
    { label: 'HoC', active: false },
    { label: '홍보글', active: false },
    { label: '건의사항', active: false },
    { label: '연구실', active: false },
    { label: 'QnA', active: false },
    { label: '+', active: false },
  ];

  const notices = Array(6).fill({
    category: '공지',
    title: '전산학부 홈페이지 완료 공지',
    date: '26.02.08',
  });

  return (
    <section className="bg-kaist-white">
      <div className="mx-auto w-full max-w-4xl px-4">
        {/* Tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {tabs.map((tab, index) => (
            <button
              key={index}
              className={`text-base font-extrabold tracking-tight transition-colors ${
                tab.active 
                  ? 'text-kaist-darkgreen' 
                  : 'text-kaist-lightgreen hover:text-kaist-darkgreen'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="relative mb-3 flex-shrink-0">
          <div className="h-0.5 w-full bg-[#DBDDD5]" />
          <div className="absolute left-0 top-0 h-0.5 w-12 bg-kaist-darkgreen" />
        </div>

        {/* Notice List */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {notices.map((notice, index) => (
            <NoticeItem key={index} {...notice} />
          ))}
        </div>
      </div>
    </section>
  );
}
