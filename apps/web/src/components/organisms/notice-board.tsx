import { useState } from 'react';

interface NoticeItemProps {
  category: string;
  title: string;
  date: string;
}

function NoticeItem({ category, title, date }: NoticeItemProps) {
  return (
    <div className="flex items-center justify-between py-[14px] gap-2">
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const tabs = [
    { label: '공지', active: true },
    { label: '행사', active: false },
    { label: 'HoC', active: false },
    { label: '홍보글', active: false },
    { label: '건의사항', active: false },
    { label: '연구실', active: false },
    { label: 'QnA', active: false },
  ];

  const notices = Array(5).fill({
    category: '공지',
    title: '전산학부 홈페이지 완료 공지',
    date: '26.02.08',
  });

  return (
    <section className="bg-kaist-white">
      <div className="mx-auto w-full max-w-4xl px-4">
        {/* Tabs */}
        <div className="flex items-stretch justify-between gap-4 border-b-2 border-kaist-grey/30">
          <div className="flex flex-wrap items-stretch gap-4">
            {tabs.map((tab, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <button
                  className={`relative flex items-center justify-center h-full text-base font-extrabold tracking-tight transition-colors ${
                    tab.active 
                      ? 'text-kaist-darkgreen' 
                      : 'text-kaist-greygreen hover:text-kaist-darkgreen'
                  }`}
                >
                  <span className="py-2">{tab.label}</span>
                  <span 
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                      hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
          
          {/* Plus Button */}
          <div
            className="relative group"
            onMouseEnter={() => setHoveredIndex(tabs.length)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <button
              className="relative flex items-center justify-center h-full text-base font-extrabold tracking-tight text-kaist-greygreen hover:text-kaist-darkgreen transition-colors"
            >
              <span className="py-2">+</span>
              <span 
                className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                  hoveredIndex === tabs.length ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Notice List */}
        <div className="flex-1 divide-y divide-kaist-grey/20 border-b border-kaist-grey/20 overflow-y-auto">
          {notices.map((notice, index) => (
            <NoticeItem key={index} {...notice} />
          ))}
        </div>
      </div>
    </section>
  );
}
