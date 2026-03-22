import { useState } from 'react';
import { Link } from 'react-router-dom';

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
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { label: '공지' },
    { label: '행사' },
    { label: 'HoC' },
    { label: '홍보글' },
    { label: '건의사항' },
    { label: '연구실' },
    { label: 'QnA' },
  ];

  // TODO: MySQL에서 각 탭별 데이터 가져오기
  const noticesByTab: Record<number, NoticeItemProps[]> = {
    0: Array(5).fill({ category: '공지', title: '전산학부 홈페이지 완료 공지', date: '26.02.08' }),
    1: Array(5).fill({ category: '행사', title: '전산학부 간식 이벤트', date: '26.03.01' }),
    2: Array(5).fill({ category: 'HoC', title: 'Hall of Code 프로젝트', date: '26.02.28' }),
    3: Array(5).fill({ category: '홍보글', title: '전산학부 홍보 내용', date: '26.02.25' }),
    4: Array(5).fill({ category: '건의사항', title: '학생 건의사항 접수', date: '26.02.20' }),
    5: Array(5).fill({ category: '연구실', title: '연구실 공지사항', date: '26.02.15' }),
    6: Array(5).fill({ category: 'QnA', title: '자주 묻는 질문', date: '26.02.10' }),
  };

  const currentNotices = noticesByTab[activeTab] || [];

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
                  onClick={() => setActiveTab(index)}
                  className={`relative flex items-center justify-center h-full text-base font-extrabold tracking-tight transition-colors ${
                    activeTab === index 
                      ? 'text-kaist-darkgreen' 
                      : 'text-kaist-greygreen hover:text-kaist-darkgreen'
                  }`}
                >
                  <span className="py-2">{tab.label}</span>
                  <span 
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                      activeTab === index ? 'scale-x-100' : hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
          
          {/* Plus Button */}
          <Link
            to={`/board/${tabs[activeTab].label}`}
            className="relative group"
            onMouseEnter={() => setHoveredIndex(tabs.length)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="relative flex items-center justify-center h-full text-base font-extrabold tracking-tight text-kaist-greygreen hover:text-kaist-darkgreen transition-colors">
              <span className="py-2">+</span>
              <span 
                className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                  hoveredIndex === tabs.length ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </div>
          </Link>
        </div>

        {/* Notice List */}
        <div className="flex-1 divide-y divide-kaist-grey/20 border-b border-kaist-grey/20 overflow-y-auto">
          {currentNotices.map((notice, index) => (
            <NoticeItem key={`${activeTab}-${index}`} {...notice} />
          ))}
        </div>
      </div>
    </section>
  );
}
